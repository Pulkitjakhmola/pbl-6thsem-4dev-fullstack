import { Router, Request, Response } from 'express';
import multer from 'multer';
import { join } from 'path';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, getUser } from '../middleware/auth.js';

export const rulesRouter = Router({ mergeParams: true });
rulesRouter.use(authMiddleware);

// File upload config for .ams scripts
const upload = multer({
  dest: join(process.cwd(), 'uploads'),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (file.originalname.endsWith('.ams') || file.mimetype === 'text/plain') {
      cb(null, true);
    } else {
      cb(new Error('Only .ams files are allowed'));
    }
  },
});

// ── Pre-built GUI templates ──
const RULE_TEMPLATES = [
  {
    id: 'brute_force',
    name: 'Brute Force Detection',
    description: 'Detect repeated failed login attempts',
    condition_logic: {
      event: 'FAILED_LOGIN',
      threshold: 5,
      window_minutes: 10,
      actions: ['ALERT', 'SEND_EMAIL', 'LOG'],
    },
    ams_code: `MONITOR "{source}"
RULE BruteForceDetection SEVERITY HIGH
WHEN "FAILED_LOGIN"
OCCURS {threshold} TIMES IN {window_minutes} MINUTES
DO
    ALERT("Brute force attack detected!")
    SEND_EMAIL("{email}")
    LOG("alerts.log")
END`,
  },
  {
    id: 'sql_injection',
    name: 'SQL Injection Detection',
    description: 'Monitor for SQL injection patterns in queries',
    condition_logic: {
      event: 'SQL_PATTERN',
      pattern: '(SELECT|INSERT|UPDATE|DELETE).*(\'|;|--)',
      actions: ['ALERT', 'BLOCK_IP'],
    },
    ams_code: `MONITOR "{source}"
RULE SQLInjectionDetection SEVERITY CRITICAL
WHEN regex("(SELECT|INSERT|UPDATE|DELETE).*(\'|;|--)")
DO
    ALERT("SQL injection attempt detected")
    BLOCK_IP("source_ip")
END`,
  },
  {
    id: 'port_scan',
    name: 'Port Scan Detection',
    description: 'Detect port scanning activity',
    condition_logic: {
      event: 'CONNECTION_ATTEMPT',
      threshold: 20,
      window_minutes: 1,
      actions: ['ALERT', 'BLOCK_IP', 'LOG'],
    },
    ams_code: `MONITOR "{source}"
RULE PortScanDetection SEVERITY HIGH
WHEN "CONNECTION_ATTEMPT"
OCCURS {threshold} TIMES IN {window_minutes} MINUTES
DO
    ALERT("Port scan detected")
    BLOCK_IP("source_ip")
    LOG("security.log")
END`,
  },
  {
    id: 'unauthorized_access',
    name: 'Unauthorized Access',
    description: 'Detect unauthorized access attempts',
    condition_logic: {
      event: 'ACCESS_DENIED',
      threshold: 3,
      window_minutes: 5,
      actions: ['ALERT', 'SEND_EMAIL'],
    },
    ams_code: `MONITOR "{source}"
RULE UnauthorizedAccess SEVERITY MEDIUM
WHEN "ACCESS_DENIED"
OCCURS {threshold} TIMES IN {window_minutes} MINUTES
DO
    ALERT("Unauthorized access detected")
    SEND_EMAIL("{email}")
END`,
  },
  {
    id: 'error_spike',
    name: 'Error Rate Spike',
    description: 'Detect sudden increase in application errors',
    condition_logic: {
      event: 'ERROR',
      threshold: 50,
      window_minutes: 5,
      actions: ['ALERT', 'CALL_API'],
    },
    ams_code: `MONITOR "{source}"
RULE ErrorSpike SEVERITY HIGH
WHEN "ERROR"
OCCURS {threshold} TIMES IN {window_minutes} MINUTES
DO
    ALERT("Error rate spike detected!")
    CALL_API("{webhook}")
END`,
  },
];

/** GET /api/rules/templates — list pre-built rule templates */
rulesRouter.get('/templates', (_req: Request, res: Response): void => {
  res.json(RULE_TEMPLATES.map(({ ams_code, ...t }) => t));
});

/** POST /api/projects/:projectId/rules — create a detection rule */
rulesRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;
    const { name, rule_type, condition_logic, template_id, notify_users, notify_routes } = req.body;

    if (!name) { res.status(400).json({ error: 'name is required' }); return; }

    let logic = condition_logic;
    // If using a template, merge template logic with user customizations
    if (template_id) {
      const template = RULE_TEMPLATES.find((t) => t.id === template_id);
      if (template) logic = { ...template.condition_logic, ...condition_logic, template_id };
    }

    const rule = await prisma.detectionRule.create({
      data: {
        project_id: projectId,
        name,
        rule_type: rule_type === 'SCRIPT' ? 'SCRIPT' : 'GUI',
        condition_logic: logic ?? {},
        user_mappings: notify_users?.length
          ? { createMany: { data: notify_users.map((uid: string) => ({ user_id: uid })) } }
          : undefined,
        route_mappings: notify_routes?.length
          ? { createMany: { data: notify_routes.map((rid: string) => ({ route_id: rid })) } }
          : undefined,
      },
      include: {
        user_mappings: { include: { user: { select: { id: true, name: true, email: true } } } },
        route_mappings: { include: { route: true } },
        script_file: true,
      },
    });

    res.status(201).json(rule);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** GET /api/projects/:projectId/rules — list rules */
rulesRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const rules = await prisma.detectionRule.findMany({
      where: { project_id: req.params.projectId },
      include: {
        script_file: true,
        user_mappings: { include: { user: { select: { id: true, name: true, email: true } } } },
        route_mappings: { include: { route: { include: { channels: true } } } },
      },
      orderBy: { created_at: 'desc' },
    });
    res.json(rules);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** PATCH /api/projects/:projectId/rules/:ruleId — update rule */
rulesRouter.patch('/:ruleId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, condition_logic, is_active, notify_users, notify_routes } = req.body;
    const { ruleId } = req.params;

    // Update base fields
    const rule = await prisma.detectionRule.update({
      where: { id: ruleId },
      data: {
        ...(name !== undefined && { name }),
        ...(condition_logic !== undefined && { condition_logic }),
        ...(is_active !== undefined && { is_active }),
      },
    });

    // Update user mappings if provided
    if (notify_users) {
      await prisma.ruleUserMapping.deleteMany({ where: { rule_id: ruleId } });
      if (notify_users.length) {
        await prisma.ruleUserMapping.createMany({
          data: notify_users.map((uid: string) => ({ rule_id: ruleId, user_id: uid })),
        });
      }
    }

    // Update route mappings if provided
    if (notify_routes) {
      await prisma.ruleRouteMapping.deleteMany({ where: { rule_id: ruleId } });
      if (notify_routes.length) {
        await prisma.ruleRouteMapping.createMany({
          data: notify_routes.map((rid: string) => ({ rule_id: ruleId, route_id: rid })),
        });
      }
    }

    const updated = await prisma.detectionRule.findUnique({
      where: { id: ruleId },
      include: { script_file: true, user_mappings: true, route_mappings: true },
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** POST /api/projects/:projectId/rules/:ruleId/upload — upload .ams script file */
rulesRouter.post('/:ruleId/upload', upload.single('script'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { ruleId } = req.params;
    const file = req.file;
    if (!file) { res.status(400).json({ error: 'No file uploaded' }); return; }

    // Upsert script file
    const scriptFile = await prisma.scriptFile.upsert({
      where: { rule_id: ruleId },
      create: { rule_id: ruleId, storage_path: file.path },
      update: { storage_path: file.path },
    });

    // Mark rule as SCRIPT type
    await prisma.detectionRule.update({
      where: { id: ruleId },
      data: { rule_type: 'SCRIPT' },
    });

    res.json(scriptFile);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** DELETE /api/projects/:projectId/rules/:ruleId */
rulesRouter.delete('/:ruleId', async (req: Request, res: Response): Promise<void> => {
  try {
    await prisma.detectionRule.delete({ where: { id: req.params.ruleId } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
