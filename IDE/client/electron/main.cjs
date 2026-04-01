const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const { spawn } = require('child_process');
const fsSync = require('fs');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0d1117',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // In dev, load from Vite; in prod, load built files
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadURL('http://localhost:5173');
  }

  mainWindow.once('ready-to-show', () => mainWindow.show());
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// ── Window Controls ──
ipcMain.handle('minimize', () => mainWindow?.minimize());
ipcMain.handle('maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.handle('close', () => mainWindow?.close());
ipcMain.handle('isMaximized', () => mainWindow?.isMaximized());

// ── File System ──
ipcMain.handle('readFile', async (_e, filePath) => {
  return fs.readFile(filePath, 'utf8');
});

ipcMain.handle('writeFile', async (_e, filePath, content) => {
  await fs.writeFile(filePath, content, 'utf8');
  return { ok: true };
});

ipcMain.handle('deleteFile', async (_e, filePath) => {
  const info = await fs.stat(filePath);
  if (info.isDirectory()) {
    await fs.rm(filePath, { recursive: true, force: true });
  } else {
    await fs.unlink(filePath);
  }
  return { ok: true };
});

ipcMain.handle('renameFile', async (_e, oldPath, newPath) => {
  await fs.rename(oldPath, newPath);
  return { ok: true };
});

ipcMain.handle('readDir', async (_e, dirPath) => {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  return Promise.all(
    entries.filter(e => !e.name.startsWith('.')).map(async (e) => {
      const fullPath = path.join(dirPath, e.name);
      const info = await fs.stat(fullPath).catch(() => null);
      return {
        name: e.name,
        path: fullPath,
        isDirectory: e.isDirectory(),
        size: info?.size ?? 0,
        modified: info?.mtime?.toISOString() ?? '',
      };
    })
  );
});

// ── Dialogs ──
ipcMain.handle('openFileDialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    filters: [{ name: 'AMS Scripts', extensions: ['ams'] }, { name: 'All Files', extensions: ['*'] }],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('openFolderDialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  return result.canceled ? null : result.filePaths[0];
});

// ── Compiler ──
ipcMain.handle('runCompiler', async (_e, opts) => {
  return new Promise((resolve) => {
    const proc = spawn(opts.compilerPath, ['build', opts.inputFile]);
    let stdout = '', stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => resolve({ stdout, stderr, code }));
    proc.on('error', (err) => resolve({ stdout, stderr: err.message, code: 1 }));
  });
});

// ── External Links ──
ipcMain.handle('openExternal', (_e, url) => shell.openExternal(url));
