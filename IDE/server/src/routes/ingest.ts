import { Router, Request, Response } from 'express';
import { dispatchNotification } from './notifications.js';

export const ingestRouter = Router();

// In-memory telemetry store
const telemetry: TelemetryEntry[] = [];

export interface TelemetryEntry {
  id: string;
  sessionId: string;
  timestamp: Date;
  source: string;
  level: 'info' | 'warn' | 'error' | 'critical';
  raw: string;
  parsed: Record<string, unknown>;
  ruleHits: string[];
}

/** Dispatch notifications for any rule hits in the telemetry entry */
async function processRuleHits(entry: TelemetryEntry): Promise<void> {
  if (!entry.ruleHits?.length) return;
  for (const ruleId of entry.ruleHits) {
    try {
      await dispatchNotification({
        ruleId,
        projectId: (entry.parsed?.projectId as string) ?? '',
        title: `Rule triggered: ${ruleId}`,
        message: entry.raw || 'Event detected by monitoring rule',
        severity: entry.level === 'critical' ? 'critical' : entry.level === 'error' ? 'high' : 'medium',
      });
    } catch { /* notification dispatch errors should not block ingestion */ }
  }
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

  // Process rule hits asynchronously (don't block the response)
  processRuleHits(entry);

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

/**
 * GET /api/ingest/stats
 * Returns rule hit counts and a 12-bucket (5-min each = last hour) event trend
 * derived from the live in-memory telemetry store.
 */
ingestRouter.get('/stats', (_req: Request, res: Response) => {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;
  const bucketMs = 5 * 60 * 1000; // 5 minutes per bucket
  const NUM_BUCKETS = 12;

  // Rule hits: count occurrences of each rule name across all entries
  const ruleHitMap: Record<string, number> = {};
  // Trend buckets: index 0 = oldest (55–60 min ago), index 11 = most recent (0–5 min ago)
  const trendBuckets = Array(NUM_BUCKETS).fill(0);

  for (const entry of telemetry) {
    const ts = new Date(entry.timestamp).getTime();

    // Rule hits (all time in memory)
    for (const rule of entry.ruleHits ?? []) {
      ruleHitMap[rule] = (ruleHitMap[rule] ?? 0) + 1;
    }

    // Trend: only last hour
    if (ts >= oneHourAgo) {
      const bucketIdx = Math.min(
        NUM_BUCKETS - 1,
        Math.floor((ts - oneHourAgo) / bucketMs)
      );
      trendBuckets[bucketIdx]++;
    }
  }

  const ruleHits = Object.entries(ruleHitMap).map(([rule, hits]) => ({ rule, hits }));

  const trendData = trendBuckets.map((events, i) => ({
    t: `${(NUM_BUCKETS - 1 - i) * 5}m`,
    events,
  })).reverse();

  res.json({ ruleHits, trendData });
});

// ── Exported helpers for internal use (e.g. deploy route) ────

/** Push a telemetry entry directly (no HTTP round-trip). */
export function pushTelemetry(entry: Omit<TelemetryEntry, 'timestamp'> & { timestamp?: Date }): void {
  const full: TelemetryEntry = { ...entry, timestamp: entry.timestamp ?? new Date() };
  telemetry.push(full);
  if (telemetry.length > 10_000) telemetry.shift();
  processRuleHits(full);
}

/** Compute live stats (rule hits + trend). Used by WS stats push. */
export function getStats(): { ruleHits: { rule: string; hits: number }[]; trendData: { t: string; events: number }[] } {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;
  const bucketMs = 5 * 60 * 1000;
  const NUM_BUCKETS = 12;

  const ruleHitMap: Record<string, number> = {};
  const trendBuckets = Array(NUM_BUCKETS).fill(0);

  for (const entry of telemetry) {
    const ts = new Date(entry.timestamp).getTime();
    for (const rule of entry.ruleHits ?? []) {
      ruleHitMap[rule] = (ruleHitMap[rule] ?? 0) + 1;
    }
    if (ts >= oneHourAgo) {
      const bucketIdx = Math.min(NUM_BUCKETS - 1, Math.floor((ts - oneHourAgo) / bucketMs));
      trendBuckets[bucketIdx]++;
    }
  }

  return {
    ruleHits: Object.entries(ruleHitMap).map(([rule, hits]) => ({ rule, hits })),
    trendData: trendBuckets.map((events, i) => ({ t: `${(NUM_BUCKETS - 1 - i) * 5}m`, events })).reverse(),
  };
}
