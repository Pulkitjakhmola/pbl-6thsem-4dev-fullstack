import { Router, Request, Response } from 'express';
import { sessionManager } from '../index.js';

export const sessionsRouter = Router();

/**
 * GET /api/sessions
 * Returns list of active monitoring sessions.
 */
sessionsRouter.get('/', (_req: Request, res: Response) => {
  res.json({ sessions: sessionManager.list() });
});

/**
 * DELETE /api/sessions/:id
 * Stops and removes a running runtime session.
 */
sessionsRouter.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const stopped = sessionManager.stop(id);
  if (stopped) {
    res.json({ message: `Session ${id} stopped` });
  } else {
    res.status(404).json({ error: `Session ${id} not found` });
  }
});
