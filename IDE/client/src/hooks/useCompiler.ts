import { useState, useCallback, useRef } from 'react';
import type { AppSettings } from './useSettings';

export interface CompileOutputLine {
  stage: string;
  message: string;
  time: string;
}

const STAGE_PROGRESS: Record<string, number> = {
  lexing: 25, parsing: 50, codegen: 75, done: 100, error: 100,
};

export function useCompiler(settings: AppSettings) {
  const [compileOutput, setCompileOutput] = useState<CompileOutputLine[]>([]);
  const [isCompiling, setIsCompiling] = useState(false);
  const [progress, setProgress] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const addLine = (stage: string, message: string) => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    setCompileOutput((prev) => [...prev, { stage, message, time }]);
    setProgress(STAGE_PROGRESS[stage] ?? 50);
  };

  const compile = useCallback(
    async (source: string, _filePath?: string) => {
      if (isCompiling) return;
      setCompileOutput([]);
      setProgress(0);
      setIsCompiling(true);

      abortRef.current = new AbortController();

      try {
        const res = await fetch(`${settings.serverUrl}/api/compile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source }),
          signal: abortRef.current.signal,
        });

        if (!res.ok || !res.body) {
          addLine('error', `Server error: ${res.status}`);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const parts = buf.split('\n\n');
          buf = parts.pop() ?? '';
          for (const part of parts) {
            const line = part.replace(/^data:\s*/, '').trim();
            if (!line) continue;
            try {
              const ev = JSON.parse(line) as { stage: string; message: string };
              addLine(ev.stage, ev.message);
            } catch { /* ignore malformed */ }
          }
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          addLine('error', `Connection error: ${(err as Error).message}. Is the backend running?`);
        }
      } finally {
        setIsCompiling(false);
      }
    },
    [settings, isCompiling]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setIsCompiling(false);
    addLine('error', 'Compilation cancelled by user');
  }, []);

  return { compile, stop, compileOutput, isCompiling, progress };
}
