// Global type declarations for Electron context bridge API

interface ElectronAPI {
  // File System
  readFile:       (path: string) => Promise<string>;
  writeFile:      (path: string, content: string) => Promise<{ ok: boolean }>;
  deleteFile:     (path: string) => Promise<{ ok: boolean }>;
  renameFile:     (oldPath: string, newPath: string) => Promise<{ ok: boolean }>;
  readDir:        (path: string) => Promise<FileEntry[]>;
  mkdir:          (path: string) => Promise<{ ok: boolean }>;
  openFileDialog: () => Promise<string | null>;
  openFolderDialog: () => Promise<string | null>;
  saveFileDialog: (defaultName: string) => Promise<string | null>;

  // Compiler
  runCompiler: (opts: { compilerPath: string; inputFile: string }) =>
    Promise<{ stdout: string; stderr: string; code: number }>;

  // Window Controls
  minimize:     () => Promise<void>;
  maximize:     () => Promise<void>;
  close:        () => Promise<void>;
  isMaximized:  () => Promise<boolean>;
  openExternal: (url: string) => Promise<void>;

  // Platform
  platform: NodeJS.Platform;
}

interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  modified?: string;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
