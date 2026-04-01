import { useState, useCallback } from 'react';

export interface AppSettings {
  compilerPath: string;
  projectPath:  string;
  serverUrl:    string;
  wsUrl:        string;
  verboseCompiler: boolean;
  fontSize:     number;
  liveAST:      boolean;
  autocomplete: boolean;
  errorHighlighting: boolean;
  alertEmail:   string;
  slackWebhook: string;
  apiEndpoint:  string;
}

const DEFAULTS: AppSettings = {
  compilerPath: 'D:\\coding\\compiler_pbl\\ams-lang\\build\\ams.exe',
  projectPath:  'D:\\coding\\compiler_pbl\\ams-lang',
  serverUrl:    'http://localhost:3001',
  wsUrl:        'ws://localhost:3001',
  verboseCompiler: false,
  fontSize:     13,
  liveAST:      true,
  autocomplete: true,
  errorHighlighting: true,
  alertEmail:   '',
  slackWebhook: '',
  apiEndpoint:  '',
};

const STORAGE_KEY = 'ams-ide-settings';

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULTS };
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);

  const updateSettings = useCallback((next: AppSettings) => {
    setSettings(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }, []);

  return { settings, updateSettings };
}
