import { Router, Request, Response } from 'express';
import nodemailer from 'nodemailer';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, getUser } from '../middleware/auth.js';

export const notificationsRouter = Router();
notificationsRouter.use(authMiddleware);

/** GET /api/notifications — get current user's notifications */
notificationsRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = getUser(req);
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;

    const [notifications, total, unread] = await Promise.all([
      prisma.notification.findMany({
        where: { user_id: user.userId },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({ where: { user_id: user.userId } }),
      prisma.notification.count({ where: { user_id: user.userId, is_read: false } }),
    ]);

    res.json({ notifications, total, unread, page, limit });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** PATCH /api/notifications/:id/read — mark single as read */
notificationsRouter.patch('/:id/read', async (req: Request, res: Response): Promise<void> => {
  try {
    const notif = await prisma.notification.update({
      where: { id: req.params.id },
      data: { is_read: true },
    });
    res.json(notif);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** PATCH /api/notifications/read-all — mark all as read */
notificationsRouter.patch('/read-all', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = getUser(req);
    await prisma.notification.updateMany({
      where: { user_id: user.userId, is_read: false },
      data: { is_read: true },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── Notification Dispatcher (used internally by other services) ──

export async function dispatchNotification(opts: {
  ruleId: string;
  projectId: string;
  title: string;
  message: string;
  severity: string;
}): Promise<void> {
  const { ruleId, projectId, title, message, severity } = opts;

  // 1. Find all users mapped to this rule
  const userMappings = await prisma.ruleUserMapping.findMany({
    where: { rule_id: ruleId },
    select: { user_id: true },
  });

  // 2. Find all alert routes mapped to this rule
  const routeMappings = await prisma.ruleRouteMapping.findMany({
    where: { rule_id: ruleId },
    include: { route: { include: { channels: true } } },
  });

  const rule = await prisma.detectionRule.findUnique({ where: { id: ruleId } });

  // 3. Create dashboard notifications for all mapped users
  if (userMappings.length > 0) {
    await prisma.notification.createMany({
      data: userMappings.map((m) => ({
        user_id: m.user_id,
        title,
        message,
        severity,
        rule_name: rule?.name ?? 'Unknown',
        project_id: projectId,
      })),
    });
  }

  // 4. Process each route's channels
  for (const mapping of routeMappings) {
    const channels = mapping.route.channels;
    for (const channel of channels) {
      switch (channel.channel_type) {
        case 'DASHBOARD':
          // Already handled above via user mappings
          break;
        case 'EMAIL':
          if (channel.webhook_url) {
            try {
              // Note: In production it's better to reuse a single transporter instance 
              // initialized outside the loop, rather than recreating it per email.
              const transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST || 'smtp.ethereal.email',
                port: Number(process.env.SMTP_PORT) || 587,
                secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
                auth: {
                  user: process.env.SMTP_USER,
                  pass: process.env.SMTP_PASS,
                },
              });

              // For the EMAIL channel, 'webhook_url' field is assumed to hold the recipient's email address
              await transporter.sendMail({
                from: process.env.SMTP_FROM || '"AMS Scanner" <alerts@ams.local>',
                to: channel.webhook_url, 
                subject: `🚨 AMS Alert: ${title}`,
                text: `${message}\n\nSeverity: ${severity}\nRule: ${rule?.name}\nProject ID: ${projectId}`,
              });

              console.log(`[EMAIL] Successfully dispatched alert to: ${channel.webhook_url}`);
            } catch (e) {
              console.error('[EMAIL] Failed to send email via Nodemailer:', e);
            }
          }
          break;
        case 'SLACK':
          if (channel.webhook_url) {
            try {
              await fetch(channel.webhook_url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  text: `🚨 *${title}*\n${message}\nSeverity: ${severity}`,
                }),
              });
            } catch (e) { console.error('[SLACK] Error:', e); }
          }
          break;
        case 'DISCORD':
          if (channel.webhook_url) {
            try {
              await fetch(channel.webhook_url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  content: `🚨 **${title}**\n${message}\n*Severity: ${severity}*`,
                }),
              });
            } catch (e) { console.error('[DISCORD] Error:', e); }
          }
          break;
      }
    }
  }
}
