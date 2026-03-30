import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, getUser } from '../middleware/auth.js';

export const projectsRouter = Router();
projectsRouter.use(authMiddleware);

/** POST /api/projects — create a new project */
projectsRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.body;
    const user = getUser(req);
    if (!name) { res.status(400).json({ error: 'name is required' }); return; }

    const project = await prisma.project.create({
      data: {
        name,
        members: {
          create: { user_id: user.userId, project_role: 'ADMIN' },
        },
      },
      include: { members: { include: { user: { select: { id: true, name: true, email: true } } } } },
    });

    res.status(201).json(project);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** GET /api/projects — list user's projects */
projectsRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = getUser(req);

    const projects = await prisma.project.findMany({
      where: { members: { some: { user_id: user.userId } } },
      include: {
        members: { include: { user: { select: { id: true, name: true, email: true } } } },
        _count: { select: { rules: true, sources: true, routes: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** GET /api/projects/:id — project details */
projectsRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = getUser(req);
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, members: { some: { user_id: user.userId } } },
      include: {
        members: { include: { user: { select: { id: true, name: true, email: true, system_role: true } } } },
        rules: { include: { script_file: true, user_mappings: true, route_mappings: true } },
        sources: true,
        routes: { include: { channels: true } },
        _count: { select: { rules: true, sources: true } },
      },
    });

    if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** DELETE /api/projects/:id — delete project (admin only) */
projectsRouter.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = getUser(req);
    const member = await prisma.projectMember.findUnique({
      where: { user_id_project_id: { user_id: user.userId, project_id: req.params.id } },
    });
    if (!member || member.project_role !== 'ADMIN') {
      res.status(403).json({ error: 'Only project admins can delete projects' }); return;
    }

    await prisma.project.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
