import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import pino from 'pino';

// IDE routes
import { compileRouter } from './routes/compile.js';
import { parseRouter } from './routes/parse.js';
import { sessionsRouter } from './routes/sessions.js';
import { ingestRouter } from './routes/ingest.js';
import { fsRouter } from './routes/fs.js';

// Platform routes
import { authRouter } from './routes/auth.js';
import { projectsRouter } from './routes/projects.js';
import { membersRouter } from './routes/members.js';
import { logSourcesRouter } from './routes/log-sources.js';
import { rulesRouter } from './routes/rules.js';
import { alertRoutesRouter } from './routes/alert-routes.js';
import { notificationsRouter } from './routes/notifications.js';

import { setupWebSocket } from './services/websocket.js';
import { SessionManager } from './services/sessions.js';

export const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: { colorize: true },
  },
});

const app = express();
const PORT = process.env.PORT ?? 3001;

// ─── Middleware ───────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));

// ─── IDE Routes ──────────────────────────────────────────────
app.use('/api/compile', compileRouter);
app.use('/api/parse', parseRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/ingest', ingestRouter);
app.use('/api/fs', fsRouter);

// ─── Platform Routes ─────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/projects/:projectId/members', membersRouter);
app.use('/api/projects/:projectId/sources', logSourcesRouter);
app.use('/api/projects/:projectId/rules', rulesRouter);
app.use('/api/projects/:projectId/alerts', alertRoutesRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/rules', rulesRouter); // templates endpoint

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ─── HTTP + WebSocket Server ──────────────────────────────────
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: '/ws/runtime' });

const sessionManager = new SessionManager();
setupWebSocket(wss, sessionManager);

httpServer.listen(PORT, () => {
  logger.info(`AMScode backend running on http://localhost:${PORT}`);
});

export { sessionManager };

