import { Router, Request, Response } from 'express';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { v4 as uuidv4 } from 'uuid';
import { parseAMS } from '../services/parser.js';

export const parseRouter = Router();

/**
 * POST /api/parse
 * Body: { source: string }
 * Returns: { ast: ASTNode }
 * Called on every keystroke (debounced 400ms in client) for live AST panel.
 */
parseRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  const { source } = req.body as { source: string };

  if (!source || typeof source !== 'string') {
    res.status(400).json({ error: 'source is required' });
    return;
  }

  try {
    const ast = parseAMS(source);
    res.json({ ast });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(422).json({ error: message, ast: null });
  }
});
