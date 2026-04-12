import { Router, Request, Response } from 'express';
import { spawn, execFile, ChildProcess } from 'child_process';
import { writeFile, unlink, mkdir, access } from 'fs/promises';
import { join, dirname, basename } from 'path';
import { tmpdir } from 'os';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../index.js';
import { sessionManager } from '../index.js';
import { AmsOutputAdapter, logToAlert } from '../services/log-parser.js';
import { pushTelemetry, getStats } from './ingest.js';

const parser = new AmsOutputAdapter();

export const deployRouter = Router();

// Track running processes
const runningProcesses = new Map<string, ChildProcess>();

/**
 * Attach stdout/stderr parsing, telemetry, alerts, and stats push to a process.
 * Returns the stats interval so the caller can clear it.
 */
function attachProcessMonitoring(
  proc: ChildProcess,
  session: ReturnType<typeof sessionManager.create>,
  defaultSource: string,
): NodeJS.Timeout {
  const processChunk = (chunk: Buffer, fallbackLevel: 'info' | 'error') => {
    const raw = chunk.toString();
    logger.info({ sessionId: session.id, rawLength: raw.length, fallbackLevel, preview: raw.substring(0, 200) }, '[DEPLOY-DEBUG] processChunk received data');
    const lines = raw.split(/\r?\n/).filter((l) => l.trim());
    for (const line of lines) {
      const entry = parser.parse(line, defaultSource);
      if (fallbackLevel === 'error' && entry.level === 'info') {
        entry.level = 'error';
      }

      logger.info({ sessionId: session.id, level: entry.level, message: entry.message, rule: entry.rule, clients: session.clients.size }, '[DEPLOY-DEBUG] Emitting log entry');
      session.emit('log', entry);

      pushTelemetry({
        id: entry.id,
        sessionId: session.id,
        source: entry.source,
        level: entry.level,
        raw: line,
        parsed: { message: entry.message, rule: entry.rule },
        ruleHits: entry.rule ? [entry.rule] : [],
      });

      const alert = logToAlert(entry);
      if (alert) {
        session.emit('alert', alert);
      }
    }
  };

  proc.stdout?.on('data', (chunk: Buffer) => processChunk(chunk, 'info'));
  proc.stderr?.on('data', (chunk: Buffer) => processChunk(chunk, 'error'));

  const statsInterval = setInterval(() => {
    if (session.clients.size === 0) return;
    session.emit('stats', getStats());
  }, 5000);

  return statsInterval;
}

/**
 * POST /api/deploy
 * Body: { source: string, compilerPath: string, compileCommand?: string, fileExtension?: string, filePath?: string }
 *
 * Deploys a compiled monitoring script as a managed runtime process.
 * For AMS build mode: compiles first, then runs the resulting executable.
 * Returns the session ID for tracking via WebSocket.
 */
deployRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  const {
    source,
    compilerPath,
    compileCommand = '{FILE}',
    fileExtension = '.ams',
    filePath,
  } = req.body as {
    source: string;
    compilerPath?: string;
    compileCommand?: string;
    fileExtension?: string;
    filePath?: string;
  };

  if (!source || typeof source !== 'string') {
    res.status(400).json({ error: 'source is required' });
    return;
  }

  if (!compilerPath) {
    res.status(400).json({ error: 'compilerPath is required. Configure it in Settings.' });
    return;
  }

  const tmpDir = join(tmpdir(), 'amscode-deploy');
  await mkdir(tmpDir, { recursive: true });
  const ext = fileExtension.startsWith('.') ? fileExtension : `.${fileExtension}`;
  const inputFile = join(tmpDir, `${uuidv4()}${ext}`);

  try {
    await writeFile(inputFile, source, 'utf8');

    const args = compileCommand
      .split(/\s+/)
      .filter(Boolean)
      .map((tok: string) => tok.replace(/\{FILE\}/g, inputFile));

    const session = sessionManager.create();

    // Detect AMS "build" mode — two-phase: compile then run the exe
    const isBuildMode = args[0] === 'build' && ext === '.ams';

    if (isBuildMode) {
      // Phase 1: Compile — run `ams.exe build <file.ams>` and wait for it to finish
      // CWD must be the compiler's own directory so the hardcoded `-I ..` flag
      // in ams.exe resolves to the correct standard-library include path.
      const compilerDir = dirname(compilerPath);
      logger.info({ sessionId: session.id, compilerDir }, 'Phase 1: Compiling AMS script...');

      // ams.exe outputs the compiled exe into its CWD, not alongside the input
      const exePath = join(compilerDir, basename(inputFile).replace(/\.ams$/i, '.exe'));

      await new Promise<void>((resolve, reject) => {
        const compileProc = execFile(compilerPath, args, { timeout: 30000, cwd: compilerDir }, (err, stdout, stderr) => {
          if (stdout) {
            const entry = parser.parse(stdout.trim(), 'compiler');
            session.emit('log', entry);
          }
          if (stderr) {
            const entry = parser.parse(stderr.trim(), 'compiler');
            entry.level = 'error';
            session.emit('log', entry);
          }
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });

      // Verify the exe was created
      try {
        await access(exePath);
      } catch {
        session.emit('status', { status: 'error', message: 'Compilation produced no executable' });
        res.status(500).json({ error: 'Compilation failed — no executable produced' });
        unlink(inputFile).catch(() => {});
        return;
      }

      // Phase 2: Run the compiled exe as a long-running monitored process.
      // CWD is the original file's directory so that relative paths inside the
      // AMS script (e.g. `OPEN LOG_SOURCE "logfile_demo/app.log"`) resolve correctly.
      const runtimeCwd = filePath ? dirname(filePath) : dirname(inputFile);
      logger.info({ sessionId: session.id, exePath, runtimeCwd, filePath, clients: session.clients.size }, '[DEPLOY-DEBUG] Phase 2: Running compiled monitor...');
      const runtimeProc = spawn(exePath, [], { timeout: 0, cwd: runtimeCwd });
      runningProcesses.set(session.id, runtimeProc);

      logger.info({ sessionId: session.id, pid: runtimeProc.pid, hasStdout: !!runtimeProc.stdout, hasStderr: !!runtimeProc.stderr }, '[DEPLOY-DEBUG] Runtime process spawned');

      const statsInterval = attachProcessMonitoring(runtimeProc, session, 'monitor');

      runtimeProc.on('close', (code) => {
        clearInterval(statsInterval);
        runningProcesses.delete(session.id);
        session.emit('stats', getStats());
        session.emit('status', { status: 'stopped', code });
        logger.info({ sessionId: session.id, code }, 'Deployed monitor process exited');
        unlink(inputFile).catch(() => {});
        unlink(exePath).catch(() => {});
      });

      runtimeProc.on('error', (err) => {
        clearInterval(statsInterval);
        runningProcesses.delete(session.id);
        session.emit('status', { status: 'error', message: err.message });
        logger.error({ err, sessionId: session.id }, 'Monitor process error');
        unlink(inputFile).catch(() => {});
        unlink(exePath).catch(() => {});
      });
    } else {
      // Non-build mode: run the command directly as a long-running process
      const proc = spawn(compilerPath, args, { timeout: 0 });
      runningProcesses.set(session.id, proc);

      const statsInterval = attachProcessMonitoring(proc, session, inputFile);

      proc.on('close', (code) => {
        clearInterval(statsInterval);
        runningProcesses.delete(session.id);
        session.emit('stats', getStats());
        session.emit('status', { status: 'stopped', code });
        logger.info({ sessionId: session.id, code }, 'Deployed process exited');
        unlink(inputFile).catch(() => {});
      });

      proc.on('error', (err) => {
        clearInterval(statsInterval);
        runningProcesses.delete(session.id);
        session.emit('status', { status: 'error', message: err.message });
        logger.error({ err, sessionId: session.id }, 'Deploy process error');
        unlink(inputFile).catch(() => {});
      });
    }

    logger.info({ sessionId: session.id, compilerPath, isBuildMode }, 'Deployed monitoring script');

    res.status(201).json({
      sessionId: session.id,
      status: 'running',
      message: isBuildMode ? 'Script compiled and deployed' : 'Script deployed successfully',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `Deploy error: ${message}` });
    unlink(inputFile).catch(() => {});
  }
});

/** GET /api/deploy — list all running deployments */
deployRouter.get('/', (_req: Request, res: Response): void => {
  const deployments = sessionManager.list().filter((s) => s.status === 'active');
  res.json({ deployments });
});

/** DELETE /api/deploy/:id — stop a deployed process */
deployRouter.delete('/:id', (req: Request, res: Response): void => {
  const { id } = req.params;
  const proc = runningProcesses.get(id);
  if (proc) {
    proc.kill();
    runningProcesses.delete(id);
  }
  const stopped = sessionManager.stop(id);
  if (stopped) {
    res.json({ message: `Deployment ${id} stopped` });
  } else {
    res.status(404).json({ error: `Deployment ${id} not found` });
  }
});
