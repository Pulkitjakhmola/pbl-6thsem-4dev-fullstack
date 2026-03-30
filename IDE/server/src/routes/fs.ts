import { Router, Request, Response } from 'express';
import { readFile, readdir, stat, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export const fsRouter = Router();

/**
 * GET /api/fs/readdir?path=<dir>
 * Returns directory listing for the file explorer (web mode).
 */
fsRouter.get('/readdir', async (req: Request, res: Response): Promise<void> => {
  const dirPath = req.query.path as string;
  if (!dirPath) { res.status(400).json({ error: 'path is required' }); return; }

  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    const result = await Promise.all(
      entries
        .filter((e) => !e.name.startsWith('.')) // hide hidden files
        .map(async (e) => {
          const fullPath = join(dirPath, e.name);
          const info = await stat(fullPath).catch(() => null);
          return {
            name: e.name,
            path: fullPath,
            isDirectory: e.isDirectory(),
            size: info?.size ?? 0,
            modified: info?.mtime.toISOString() ?? '',
          };
        })
    );
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

/**
 * GET /api/fs/readfile?path=<file>
 * Returns file contents as text (web mode).
 */
fsRouter.get('/readfile', async (req: Request, res: Response): Promise<void> => {
  const filePath = req.query.path as string;
  if (!filePath) { res.status(400).json({ error: 'path is required' }); return; }

  try {
    const content = await readFile(filePath, 'utf8');
    res.json({ content });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

/**
 * POST /api/fs/writefile
 * Body: { path: string, content: string }
 */
fsRouter.post('/writefile', async (req: Request, res: Response): Promise<void> => {
  const { path: filePath, content } = req.body as { path: string; content: string };
  if (!filePath) { res.status(400).json({ error: 'path is required' }); return; }

  try {
    await writeFile(filePath, content, 'utf8');
    res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});
