import { Router, Request, Response } from 'express';
import { spawn } from 'child_process';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../index.js';

export const compileRouter = Router();

/**
 * POST /api/compile
 * Body: { source: string, sessionId?: string, compilerPath?: string, compileCommand?: string, fileExtension?: string }
 *
 * compileCommand uses {FILE} as a placeholder for the temp input file.
 * Example: "build {FILE}" → ["build", "/tmp/.../abc.ams"]
 * Example: "-o {FILE}.out {FILE}" → ["-o", "/tmp/.../abc.c.out", "/tmp/.../abc.c"]
 *
 * Streams SSE events: { stage, message, artifact? }
 */
compileRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  const {
    source,
    sessionId = uuidv4(),
    compilerPath,
    compileCommand = '{FILE}',
    fileExtension = '.tmp',
  } = req.body as {
    source: string;
    sessionId?: string;
    compilerPath?: string;
    compileCommand?: string;
    fileExtension?: string;
  };

  if (!source || typeof source !== 'string') {
    res.status(400).json({ error: 'source is required' });
    return;
  }

  if (!compilerPath) {
    res.status(400).json({ error: 'compilerPath is required. Configure it in Settings.' });
    return;
  }

  // ── Set up SSE ────────────────────────────────────────────
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (stage: string, message: string, artifact?: string) => {
    res.write(
      `data: ${JSON.stringify({ stage, message, sessionId, artifact })}\n\n`
    );
  };

  // ── Write source to temp file ─────────────────────────────
  const tmpDir = join(tmpdir(), 'amscode-ide');
  await mkdir(tmpDir, { recursive: true });
  const ext = fileExtension.startsWith('.') ? fileExtension : `.${fileExtension}`;
  const inputFile = join(tmpDir, `${sessionId}${ext}`);

  try {
    await writeFile(inputFile, source, 'utf8');
    send('lexing', 'Wrote source to temp file, starting compilation...');

    // ── Build args by replacing {FILE} placeholder ─────────
    const args = compileCommand
      .split(/\s+/)
      .filter(Boolean)
      .map((tok: string) => tok.replace(/\{FILE\}/g, inputFile));

    // ── Spawn compiler ─────────────────────────────────────
    const compilerProcess = spawn(compilerPath, args, {
      cwd: dirname(compilerPath),
      timeout: 30_000,
    });

    let stderrBuf = '';

    compilerProcess.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      // Parse stage hints from compiler stdout if present
      if (/\[SUCCESS\]/i.test(text)) {
        send('done', text.trim());
      } else if (/\[ERROR\]/i.test(text)) {
        send('error', text.trim());
      } else if (/\bsemantic/i.test(text)) {
        send('semantic', text.trim());
      } else if (/\blex/i.test(text)) {
        send('lexing', text.trim());
      } else if (/\bpars/i.test(text)) {
        send('parsing', text.trim());
      } else if (/\bcode\s*gen|codegen|emit/i.test(text)) {
        send('codegen', text.trim());
      } else {
        send('codegen', text.trim());
      }
    });

    compilerProcess.stderr.on('data', (chunk: Buffer) => {
      stderrBuf += chunk.toString();
      send('error', chunk.toString().trim());
    });

    compilerProcess.on('close', async (code) => {
      try {
        await unlink(inputFile).catch(() => { });

        if (code === 0) {
          send('done', `Compilation succeeded (exit ${code})`);
          logger.info({ sessionId, code }, 'Compilation succeeded');
        } else {
          send('error', `Compilation failed (exit ${code}): ${stderrBuf}`);
          logger.warn({ sessionId, code, stderrBuf }, 'Compilation failed');
        }
      } finally {
        res.end();
      }
    });

    compilerProcess.on('error', (err) => {
      send('error', `Compiler process error: ${err.message}`);
      logger.error({ err }, 'Compiler process error');
      res.end();
    });

    req.on('close', () => {
      compilerProcess.kill();
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    send('error', `Server error: ${message}`);
    res.end();
  }
});
