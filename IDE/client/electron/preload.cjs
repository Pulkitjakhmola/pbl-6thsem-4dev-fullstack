const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // File System
  readFile:        (path) => ipcRenderer.invoke('readFile', path),
  writeFile:       (path, content) => ipcRenderer.invoke('writeFile', path, content),
  deleteFile:      (path) => ipcRenderer.invoke('deleteFile', path),
  renameFile:      (oldPath, newPath) => ipcRenderer.invoke('renameFile', oldPath, newPath),
  readDir:         (path) => ipcRenderer.invoke('readDir', path),
  openFileDialog:  () => ipcRenderer.invoke('openFileDialog'),
  openFolderDialog:() => ipcRenderer.invoke('openFolderDialog'),

  // Compiler
  runCompiler:     (opts) => ipcRenderer.invoke('runCompiler', opts),

  // Window Controls
  minimize:        () => ipcRenderer.invoke('minimize'),
  maximize:        () => ipcRenderer.invoke('maximize'),
  close:           () => ipcRenderer.invoke('close'),
  isMaximized:     () => ipcRenderer.invoke('isMaximized'),
  openExternal:    (url) => ipcRenderer.invoke('openExternal', url),

  // Platform
  platform:        process.platform,
});
