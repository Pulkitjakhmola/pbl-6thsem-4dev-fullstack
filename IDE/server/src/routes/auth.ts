import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { signToken } from '../middleware/auth.js';

export const authRouter = Router();

/** POST /api/auth/register */
authRouter.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      res.status(400).json({ error: 'name, email, and password are required' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const password_hash = await bcrypt.hash(password, 10);

    // First user gets SUPER_ADMIN
    const count = await prisma.user.count();
    const system_role = count === 0 ? 'SUPER_ADMIN' as const : 'USER' as const;

    const user = await prisma.user.create({
      data: { name, email, password_hash, system_role },
      select: { id: true, name: true, email: true, system_role: true },
    });

    const token = signToken({ userId: user.id, email: user.email, role: user.system_role });

    res.status(201).json({ user, token });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** POST /api/auth/login */
authRouter.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'email and password are required' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = signToken({ userId: user.id, email: user.email, role: user.system_role });

    res.json({
      user: { id: user.id, name: user.name, email: user.email, system_role: user.system_role },
      token,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** GET /api/auth/me — get current user profile */
authRouter.get('/me', async (req: Request, res: Response): Promise<void> => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) { res.status(401).json({ error: 'No token' }); return; }
    const jwt = await import('../middleware/auth.js');
    const payload = jwt.verifyToken(header.slice(7));

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, name: true, email: true, system_role: true, created_at: true },
    });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    res.json(user);
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});
