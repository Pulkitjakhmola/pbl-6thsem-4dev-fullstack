import { contextBridge, ipcRenderer } from 'electron';

/** Safe API exposed to the renderer process via window.electronAPI */
const electronAPI = {
  // File System
  readFile: (path: string) => ipcRenderer.invoke('fs:readFile', path),
  writeFile: (path: string, content: string) => ipcRenderer.invoke('fs:writeFile', path, content),
  readDir: (path: string) => ipcRenderer.invoke('fs:readDir', path),
  mkdir: (path: string) => ipcRenderer.invoke('fs:mkdir', path),
  openFileDialog: () => ipcRenderer.invoke('dialog:openFile'),
  openFolderDialog: () => ipcRenderer.invoke('dialog:openFolder'),
  saveFileDialog: (defaultName: string) => ipcRenderer.invoke('dialog:saveFile', defaultName),

  // Compiler
  runCompiler: (opts: { compilerPath: string; inputFile: string }) =>
    ipcRenderer.invoke('compiler:run', opts),

  // Window Controls
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),

  // Platform
  platform: process.platform,
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
export type ElectronAPI = typeof electronAPI;
