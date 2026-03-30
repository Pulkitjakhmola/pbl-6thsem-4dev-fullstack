import { Router, Request, Response } from 'express';
import { spawn } from 'child_process';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../index.js';

export const compileRouter = Router();

// Locate the ams.exe compiler
const COMPILER_PATH =
  process.env.AMS_COMPILER_PATH ??
  'D:\\coding\\compiler_pbl\\ams-lang\\build\\ams.exe';

/**
 * POST /api/compile
 * Body: { source: string, sessionId?: string }
 * Streams SSE events: { stage, message, artifact? }
 */
compileRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  const { source, sessionId = uuidv4() } = req.body as {
    source: string;
    sessionId?: string;
  };

  if (!source || typeof source !== 'string') {
    res.status(400).json({ error: 'source is required' });
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
  const tmpDir = join(tmpdir(), 'ams-ide');
  await mkdir(tmpDir, { recursive: true });
  const inputFile = join(tmpDir, `${sessionId}.ams`);
  const outputFile = join(tmpDir, `${sessionId}.out`);

  try {
    await writeFile(inputFile, source, 'utf8');
    send('lexing', 'Wrote source to temp file, starting compilation...');

    // ── Spawn ams.exe ─────────────────────────────────────
    const compiler = spawn(COMPILER_PATH, ['build', inputFile], {
      timeout: 30_000,
    });

    let stderrBuf = '';

    compiler.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      // Parse stage hints from compiler stdout if present
      if (text.includes('Lexing') || text.includes('lexing')) {
        send('lexing', text.trim());
      } else if (text.includes('Parsing') || text.includes('parsing')) {
        send('parsing', text.trim());
      } else if (text.includes('Code') || text.includes('codegen')) {
        send('codegen', text.trim());
      } else {
        send('codegen', text.trim());
      }
    });

    compiler.stderr.on('data', (chunk: Buffer) => {
      stderrBuf += chunk.toString();
      send('error', chunk.toString().trim());
    });

    compiler.on('close', async (code) => {
      try {
        await unlink(inputFile).catch(() => {});

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

    compiler.on('error', (err) => {
      send('error', `Compiler process error: ${err.message}`);
      logger.error({ err }, 'Compiler process error');
      res.end();
    });

    req.on('close', () => {
      compiler.kill();
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    send('error', `Server error: ${message}`);
    res.end();
  }
});
