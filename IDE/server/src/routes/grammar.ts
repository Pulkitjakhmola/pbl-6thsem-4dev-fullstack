import { Router, Request, Response } from 'express';
import { readFile } from 'fs/promises';
import { logger } from '../index.js';

export const grammarRouter = Router();

/**
 * GET /api/grammar?path=<grammarPath>
 * Returns the Monaco Monarch grammar JSON from the specified file path.
 */
grammarRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  const { path } = req.query as { path?: string };

  if (!path || typeof path !== 'string') {
    res.status(400).json({ error: 'path query parameter is required' });
    return;
  }

  try {
    const content = await readFile(path, 'utf8');
    const grammar = JSON.parse(content);
    res.json(grammar);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err, path }, 'Failed to load grammar file');
    res.status(500).json({ error: `Failed to load grammar: ${message}` });
  }
});
