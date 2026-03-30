import { Router, Request, Response } from 'express';

export const ingestRouter = Router();

// In-memory telemetry store (replace with MongoDB later)
const telemetry: TelemetryEntry[] = [];

interface TelemetryEntry {
  id: string;
  sessionId: string;
  timestamp: Date;
  source: string;
  level: 'info' | 'warn' | 'error' | 'critical';
  raw: string;
  parsed: Record<string, unknown>;
  ruleHits: string[];
}

/**
 * POST /api/ingest
 * Body: TelemetryEntry (single)
 */
ingestRouter.post('/', (req: Request, res: Response) => {
  const entry = req.body as TelemetryEntry;
  entry.timestamp = new Date();
  telemetry.push(entry);

  // Keep last 10k entries in memory
  if (telemetry.length > 10_000) telemetry.shift();

  res.status(201).json({ ok: true });
});

/**
 * POST /api/ingest/batch
 * Body: { entries: TelemetryEntry[] }
 */
ingestRouter.post('/batch', (req: Request, res: Response) => {
  const { entries } = req.body as { entries: TelemetryEntry[] };
  const now = new Date();
  entries.forEach((e) => {
    e.timestamp = now;
    telemetry.push(e);
  });
  if (telemetry.length > 10_000) telemetry.splice(0, telemetry.length - 10_000);
  res.status(201).json({ ok: true, count: entries.length });
});

/**
 * GET /api/telemetry?sessionId=&from=&to=&limit=
 */
ingestRouter.get('/telemetry', (req: Request, res: Response) => {
  const { sessionId, from, to, limit = '100' } = req.query as Record<string, string>;
  let results = telemetry;
  if (sessionId) results = results.filter((e) => e.sessionId === sessionId);
  if (from) results = results.filter((e) => e.timestamp >= new Date(from));
  if (to) results = results.filter((e) => e.timestamp <= new Date(to));
  res.json({ entries: results.slice(-parseInt(limit, 10)) });
});
