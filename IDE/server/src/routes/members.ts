import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, getUser } from '../middleware/auth.js';

export const membersRouter = Router({ mergeParams: true });
membersRouter.use(authMiddleware);

/** POST /api/projects/:projectId/members — add a user to project */
membersRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const caller = getUser(req);
    const { projectId } = req.params;
    const { email, role } = req.body as { email: string; role?: string };

    if (!email) { res.status(400).json({ error: 'email is required' }); return; }

    // Check caller is admin
    const callerMember = await prisma.projectMember.findUnique({
      where: { user_id_project_id: { user_id: caller.userId, project_id: projectId } },
    });
    if (!callerMember || callerMember.project_role !== 'ADMIN') {
      res.status(403).json({ error: 'Only admins can add members' }); return;
    }

    // Find user by email
    const targetUser = await prisma.user.findUnique({ where: { email } });
    if (!targetUser) { res.status(404).json({ error: 'User not found with that email' }); return; }

    // Check not already a member
    const existing = await prisma.projectMember.findUnique({
      where: { user_id_project_id: { user_id: targetUser.id, project_id: projectId } },
    });
    if (existing) { res.status(409).json({ error: 'User is already a member' }); return; }

    const member = await prisma.projectMember.create({
      data: {
        user_id: targetUser.id,
        project_id: projectId,
        project_role: role === 'ADMIN' ? 'ADMIN' : 'VIEWER',
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    res.status(201).json(member);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** PATCH /api/projects/:projectId/members/:userId — change role */
membersRouter.patch('/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const caller = getUser(req);
    const { projectId, userId } = req.params;
    const { role } = req.body as { role: string };

    const callerMember = await prisma.projectMember.findUnique({
      where: { user_id_project_id: { user_id: caller.userId, project_id: projectId } },
    });
    if (!callerMember || callerMember.project_role !== 'ADMIN') {
      res.status(403).json({ error: 'Only admins can change roles' }); return;
    }

    const updated = await prisma.projectMember.update({
      where: { user_id_project_id: { user_id: userId, project_id: projectId } },
      data: { project_role: role === 'ADMIN' ? 'ADMIN' : 'VIEWER' },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** DELETE /api/projects/:projectId/members/:userId — remove member */
membersRouter.delete('/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const caller = getUser(req);
    const { projectId, userId } = req.params;

    const callerMember = await prisma.projectMember.findUnique({
      where: { user_id_project_id: { user_id: caller.userId, project_id: projectId } },
    });
    if (!callerMember || callerMember.project_role !== 'ADMIN') {
      res.status(403).json({ error: 'Only admins can remove members' }); return;
    }

    // Prevent admin from removing themselves if they are the only admin
    if (userId === caller.userId) {
      const adminCount = await prisma.projectMember.count({
        where: { project_id: projectId, project_role: 'ADMIN' },
      });
      if (adminCount <= 1) {
        res.status(400).json({ error: 'Cannot remove the last admin' }); return;
      }
    }

    await prisma.projectMember.delete({
      where: { user_id_project_id: { user_id: userId, project_id: projectId } },
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
