import { Router, Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, getUser } from '../middleware/auth.js';

export const logSourcesRouter = Router({ mergeParams: true });
logSourcesRouter.use(authMiddleware);

/** POST /api/projects/:projectId/sources — add a log source */
logSourcesRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;
    const { name, source_type } = req.body;
    if (!name) { res.status(400).json({ error: 'name is required' }); return; }

    // Generate a unique API key for this source
    const api_key = 'ams_' + randomBytes(24).toString('hex');

    const source = await prisma.logSource.create({
      data: {
        project_id: projectId,
        name,
        source_type: source_type ?? 'CUSTOM',
        api_key,
      },
    });

    res.status(201).json(source);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** GET /api/projects/:projectId/sources — list log sources */
logSourcesRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const sources = await prisma.logSource.findMany({
      where: { project_id: req.params.projectId },
      orderBy: { created_at: 'desc' },
    });
    res.json(sources);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** DELETE /api/projects/:projectId/sources/:sourceId */
logSourcesRouter.delete('/:sourceId', async (req: Request, res: Response): Promise<void> => {
  try {
    await prisma.logSource.delete({ where: { id: req.params.sourceId } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
