import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';

export const alertRoutesRouter = Router({ mergeParams: true });
alertRoutesRouter.use(authMiddleware);

/** POST /api/projects/:projectId/alerts — create alert route group */
alertRoutesRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, channels } = req.body;
    if (!name) { res.status(400).json({ error: 'name is required' }); return; }

    const route = await prisma.alertRoute.create({
      data: {
        project_id: req.params.projectId,
        name,
        // Always include DASHBOARD as default channel
        channels: {
          createMany: {
            data: [
              { channel_type: 'DASHBOARD' },
              ...(channels ?? []).filter((c: any) => c.channel_type !== 'DASHBOARD').map((c: any) => ({
                channel_type: c.channel_type,
                webhook_url: c.webhook_url ?? null,
              })),
            ],
          },
        },
      },
      include: { channels: true },
    });

    res.status(201).json(route);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** GET /api/projects/:projectId/alerts — list alert routes */
alertRoutesRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const routes = await prisma.alertRoute.findMany({
      where: { project_id: req.params.projectId },
      include: {
        channels: true,
        rule_mappings: { include: { rule: { select: { id: true, name: true } } } },
      },
    });
    res.json(routes);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** POST /api/projects/:projectId/alerts/:routeId/channels — add a channel */
alertRoutesRouter.post('/:routeId/channels', async (req: Request, res: Response): Promise<void> => {
  try {
    const { channel_type, webhook_url } = req.body;
    if (!channel_type) { res.status(400).json({ error: 'channel_type is required' }); return; }

    const channel = await prisma.alertChannel.create({
      data: {
        route_id: req.params.routeId,
        channel_type,
        webhook_url: webhook_url ?? null,
      },
    });

    res.status(201).json(channel);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** DELETE /api/projects/:projectId/alerts/:routeId/channels/:channelId */
alertRoutesRouter.delete('/:routeId/channels/:channelId', async (req: Request, res: Response): Promise<void> => {
  try {
    const channel = await prisma.alertChannel.findUnique({ where: { id: req.params.channelId } });
    if (channel?.channel_type === 'DASHBOARD') {
      res.status(400).json({ error: 'Cannot remove the default DASHBOARD channel' }); return;
    }
    await prisma.alertChannel.delete({ where: { id: req.params.channelId } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** DELETE /api/projects/:projectId/alerts/:routeId — delete alert route */
alertRoutesRouter.delete('/:routeId', async (req: Request, res: Response): Promise<void> => {
  try {
    await prisma.alertRoute.delete({ where: { id: req.params.routeId } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
