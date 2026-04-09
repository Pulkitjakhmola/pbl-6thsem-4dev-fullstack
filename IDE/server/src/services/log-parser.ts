import { v4 as uuidv4 } from 'uuid';

// ─── Shared types ────────────────────────────────────────────

export interface ParsedLogEntry {
  id: string;
  time: string;
  source: string;
  level: 'info' | 'warn' | 'error' | 'critical';
  message: string;
  rule?: string;
}

export interface ParsedAlert {
  id: string;
  time: string;
  rule: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  status: 'active';
}

// ─── Adapter interface (source-agnostic) ─────────────────────

export interface ILogAdapter {
  /** Parse a single raw output line into a structured log entry */
  parse(raw: string, defaultSource?: string): ParsedLogEntry;
}

// ─── AMS compiler output adapter ─────────────────────────────
//
// Recognises several formats the AMS runtime may produce:
//   1. Tagged:      [14:23:01] [auth.log] WARN: Failed login from 192.168.1.45
//   2. Prefixed:    auth.log WARN Failed login from 192.168.1.45
//   3. Level-only:  ERROR: something bad happened
//   4. Plain text:  any other line (treated as info)
//
// Also detects rule triggers in the message text:
//   - Explicit:  "RULE_TRIGGER: BruteForceDetection"
//   - Implicit:  "rule BruteForceDetection triggered"

const LEVEL_MAP: Record<string, ParsedLogEntry['level']> = {
  INFO: 'info',
  WARN: 'warn',
  WARNING: 'warn',
  ERROR: 'error',
  ERR: 'error',
  CRITICAL: 'critical',
  CRIT: 'critical',
  FATAL: 'critical',
};

const SEVERITY_MAP: Record<ParsedLogEntry['level'], ParsedAlert['severity']> = {
  info: 'low',
  warn: 'medium',
  error: 'high',
  critical: 'critical',
};

// [HH:MM:SS] [source] LEVEL: message
const TAGGED_RE = /^\[(\d{2}:\d{2}:\d{2})\]\s*\[([^\]]+)\]\s*(INFO|WARN|WARNING|ERROR|ERR|CRITICAL|CRIT|FATAL)[:\s]\s*(.+)$/i;

// source LEVEL message  (source contains a dot, e.g. auth.log)
const PREFIXED_RE = /^(\S+\.\S+)\s+(INFO|WARN|WARNING|ERROR|ERR|CRITICAL|CRIT|FATAL)[:\s]\s*(.+)$/i;

// LEVEL: message
const LEVEL_RE = /^(INFO|WARN|WARNING|ERROR|ERR|CRITICAL|CRIT|FATAL)[:\s]\s*(.+)$/i;

// Rule trigger patterns
const RULE_TRIGGER_RE = /RULE_TRIGGER:\s*(\S+)/i;
const RULE_TRIGGERED_RE = /rule\s+(\S+)\s+triggered/i;
const RULE_NAME_RE = /\b(BruteForce\w*|SQL\s*Injection|PortScan\w*|Malware\w*|Unauthorized\w*|DDoS\w*|XSS\w*)\b/i;

export class AmsOutputAdapter implements ILogAdapter {
  parse(raw: string, defaultSource = 'runtime'): ParsedLogEntry {
    const trimmed = raw.trim();
    const now = new Date().toLocaleTimeString('en-US', { hour12: false });

    let time = now;
    let source = defaultSource;
    let level: ParsedLogEntry['level'] = 'info';
    let message = trimmed;
    let rule: string | undefined;

    // Try tagged format first
    let m = TAGGED_RE.exec(trimmed);
    if (m) {
      time = m[1];
      source = m[2];
      level = LEVEL_MAP[m[3].toUpperCase()] ?? 'info';
      message = m[4];
    } else {
      // Try prefixed format
      m = PREFIXED_RE.exec(trimmed);
      if (m) {
        source = m[1];
        level = LEVEL_MAP[m[2].toUpperCase()] ?? 'info';
        message = m[3];
      } else {
        // Try level-only format
        m = LEVEL_RE.exec(trimmed);
        if (m) {
          level = LEVEL_MAP[m[1].toUpperCase()] ?? 'info';
          message = m[2];
        }
      }
    }

    // Detect rule names
    const rt = RULE_TRIGGER_RE.exec(message) ?? RULE_TRIGGERED_RE.exec(message) ?? RULE_NAME_RE.exec(message);
    if (rt) {
      rule = rt[1].replace(/\s+/g, '');
    }

    // Strip the raw "| RULE_TRIGGER: ..." suffix from the display message
    message = message.replace(/\s*\|\s*RULE_TRIGGER:\s*\S+/i, '').trim();

    return { id: uuidv4(), time, source, level, message, rule };
  }
}

// ─── Helpers ─────────────────────────────────────────────────

/** Derive an alert from a log entry that has a rule hit */
export function logToAlert(entry: ParsedLogEntry): ParsedAlert | null {
  if (!entry.rule) return null;
  return {
    id: uuidv4(),
    time: entry.time,
    rule: entry.rule,
    severity: SEVERITY_MAP[entry.level],
    message: entry.message,
    status: 'active',
  };
}
