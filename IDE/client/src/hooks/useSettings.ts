import { useState, useCallback } from 'react';

export interface AppSettings {
  compilerPath: string;
  compileCommand: string;
  fileExtension: string;
  languageName: string;
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
  grammarPath:  string;
  astCommandFlag: string;
}

const DEFAULTS: AppSettings = {
  compilerPath: '',
  compileCommand: 'build {FILE}',
  fileExtension: '.ams',
  languageName: 'AMS',
  projectPath:  '',
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
  grammarPath:  '',
  astCommandFlag: '',
};

/** Built-in presets for common compiler setups */
export interface LanguagePreset {
  label: string;
  compilerPath: string;
  compileCommand: string;
  fileExtension: string;
  languageName: string;
  grammarPath: string;
  astCommandFlag: string;
}

export const LANGUAGE_PRESETS: LanguagePreset[] = [
  {
    label: 'AMS-Lang (default)',
    compilerPath: 'D:\\coding\\compiler_pbl\\ams-lang\\build\\ams.exe',
    compileCommand: 'build {FILE}',
    fileExtension: '.ams',
    languageName: 'AMS',
    grammarPath: '',
    astCommandFlag: '',
  },
  {
    label: 'GCC (C)',
    compilerPath: 'gcc',
    compileCommand: '-o {FILE}.out {FILE}',
    fileExtension: '.c',
    languageName: 'C',
    grammarPath: '',
    astCommandFlag: '',
  },
  {
    label: 'G++ (C++)',
    compilerPath: 'g++',
    compileCommand: '-o {FILE}.out {FILE}',
    fileExtension: '.cpp',
    languageName: 'C++',
    grammarPath: '',
    astCommandFlag: '',
  },
  {
    label: 'Python',
    compilerPath: 'python',
    compileCommand: '{FILE}',
    fileExtension: '.py',
    languageName: 'Python',
    grammarPath: '',
    astCommandFlag: '',
  },
  {
    label: 'Node.js',
    compilerPath: 'node',
    compileCommand: '{FILE}',
    fileExtension: '.js',
    languageName: 'JavaScript',
    grammarPath: '',
    astCommandFlag: '',
  },
  {
    label: 'Rust (rustc)',
    compilerPath: 'rustc',
    compileCommand: '{FILE}',
    fileExtension: '.rs',
    languageName: 'Rust',
    grammarPath: '',
    astCommandFlag: '',
  },
  {
    label: 'Java (javac)',
    compilerPath: 'javac',
    compileCommand: '{FILE}',
    fileExtension: '.java',
    languageName: 'Java',
    grammarPath: '',
    astCommandFlag: '',
  },
  {
    label: 'Custom',
    compilerPath: '',
    compileCommand: '{FILE}',
    fileExtension: '',
    languageName: 'Custom',
    grammarPath: '',
    astCommandFlag: '',
  },
];

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
