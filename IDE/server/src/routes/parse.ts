import { Router, Request, Response } from 'express';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { v4 as uuidv4 } from 'uuid';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { parseAMS } from '../services/parser.js';

const execFileAsync = promisify(execFile);

export const parseRouter = Router();

/**
 * POST /api/parse
 * Body: { source: string, compilerPath?: string, astCommandFlag?: string }
 * Returns: { ast: ASTNode }
 * Called on every keystroke (debounced 400ms in client) for live AST panel.
 *
 * Strategy:
 *  1. If compilerPath is provided, try the external compiler first.
 *  2. If it fails or is not provided, fall back to the built-in parser.
 */
parseRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  const { source, compilerPath, astCommandFlag } = req.body as { 
    source: string; 
    compilerPath?: string;
    astCommandFlag?: string;
  };

  if (!source || typeof source !== 'string') {
    res.status(400).json({ error: 'source is required' });
    return;
  }

  // ── Try external compiler if both path and flag are provided ──
  if (compilerPath && astCommandFlag) {
    const tmpDir = join(tmpdir(), 'ams-ide');
    const sessionId = uuidv4();
    const inputFile = join(tmpDir, `${sessionId}.tmp`);

    try {
      await mkdir(tmpDir, { recursive: true });
      await writeFile(inputFile, source, 'utf8');

      const { stdout } = await execFileAsync(compilerPath, [astCommandFlag, inputFile], {
        timeout: 10_000,
        maxBuffer: 5 * 1024 * 1024,
      });

      await unlink(inputFile).catch(() => {});

      const ast = JSON.parse(stdout);
      res.json({ ast });
      return;
    } catch {
      // External compiler failed -- fall through to built-in parser
      await unlink(inputFile).catch(() => {});
    }
  }

  // ── Built-in parser (always available) ────────────────────────
  try {
    const ast = parseAMS(source);
    res.json({ ast });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(422).json({ error: message, ast: null });
  }
});

