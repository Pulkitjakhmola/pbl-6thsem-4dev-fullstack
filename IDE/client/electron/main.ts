import { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeImage } from 'electron';
import { join } from 'path';
import { readFile, writeFile, readdir, stat, mkdir } from 'fs/promises';
import { spawn } from 'child_process';

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    frame: false,          // custom titlebar
    backgroundColor: '#0d1117',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    icon: join(__dirname, '../public/icon.ico'),
    title: 'AMScode',
    show: false,
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  mainWindow.on('closed', () => { mainWindow = null; });
}

function createTray(): void {
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open AMScode', click: () => mainWindow?.show() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);
  tray.setToolTip('AMScode');
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => mainWindow?.show());
}

// ─── IPC: File System ─────────────────────────────────────────

ipcMain.handle('fs:readFile', async (_e, filePath: string) => {
  return readFile(filePath, 'utf8');
});

ipcMain.handle('fs:writeFile', async (_e, filePath: string, content: string) => {
  await writeFile(filePath, content, 'utf8');
  return { ok: true };
});

ipcMain.handle('fs:readDir', async (_e, dirPath: string) => {
  const entries = await readdir(dirPath, { withFileTypes: true });
  return Promise.all(
    entries.map(async (e) => {
      const fullPath = join(dirPath, e.name);
      const info = await stat(fullPath);
      return {
        name: e.name,
        path: fullPath,
        isDirectory: e.isDirectory(),
        size: info.size,
        modified: info.mtime.toISOString(),
      };
    })
  );
});

ipcMain.handle('fs:mkdir', async (_e, dirPath: string) => {
  await mkdir(dirPath, { recursive: true });
  return { ok: true };
});

ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'AMS Scripts', extensions: ['ams'] }],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('dialog:saveFile', async (_e, defaultName: string) => {
  const result = await dialog.showSaveDialog({
    defaultPath: defaultName,
    filters: [{ name: 'AMS Scripts', extensions: ['ams'] }],
  });
  return result.canceled ? null : result.filePath;
});

// ─── IPC: Compiler ────────────────────────────────────────────

ipcMain.handle(
  'compiler:run',
  async (_e, { compilerPath, inputFile }: { compilerPath: string; inputFile: string }) => {
    return new Promise<{ stdout: string; stderr: string; code: number }>((resolve) => {
      let stdout = '';
      let stderr = '';
      const proc = spawn(compilerPath, [inputFile], { timeout: 30_000 });
      proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
      proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
      proc.on('close', (code) => resolve({ stdout, stderr, code: code ?? -1 }));
      proc.on('error', (err) => resolve({ stdout: '', stderr: err.message, code: -1 }));
    });
  }
);

// ─── IPC: Window Controls ─────────────────────────────────────

ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.restore();
  else mainWindow?.maximize();
});
ipcMain.handle('window:close', () => mainWindow?.close());
ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false);

ipcMain.handle('shell:openExternal', (_e, url: string) => shell.openExternal(url));

// ─── App Lifecycle ────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
