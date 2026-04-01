import { BrowserRouter, Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useCallback, useEffect, useRef } from 'react';
import { Shield, Code, LogOut, FolderPlus, Folder } from 'lucide-react';
import { getToken, clearToken, getStoredUser } from './lib/api';
import { NotificationCenter } from './components/NotificationCenter/NotificationCenter';

// IDE Components
import { Toolbar } from './components/Toolbar/Toolbar';
import { FileExplorer } from './components/FileExplorer/FileExplorer';
import { CodeEditor } from './components/Editor/CodeEditor';
import { OutputPanel } from './components/Editor/CodeEditor';
import { ASTPanel } from './components/ASTPanel/ASTPanel';
import { Dashboard } from './components/Dashboard/Dashboard';
import { Settings } from './components/Settings/Settings';
import { useSettings } from './hooks/useSettings';
import { useCompiler } from './hooks/useCompiler';

// Platform Pages
import { AuthPage } from './pages/Auth';
import { ProjectsPage } from './pages/Projects';
import { ProjectDashboard } from './pages/ProjectDashboard';
import { TeamManagement } from './pages/TeamManagement';
import { LogSources } from './pages/LogSources';
import { RulesEditor } from './pages/RulesEditor';
import { AlertRoutes } from './pages/AlertRoutes';

import './index.css';
import './platform.css';

// ─── Types exported for child components ─────────────────────
export type ActiveTab = 'editor' | 'dashboard' | 'settings';

export interface OpenFile {
  path: string;
  name: string;
  content: string;
  isDirty: boolean;
}

// ─── Auth Guard ──────────────────────────────────────────────
function RequireAuth({ children }: { children: React.ReactNode }) {
  return getToken() ? <>{children}</> : <Navigate to="/auth" replace />;
}

// ─── Platform Layout (nav bar + content) ─────────────────────
function PlatformLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const user = getStoredUser();

  const handleLogout = () => {
    clearToken();
    localStorage.removeItem('ams_user');
    navigate('/auth');
  };

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <div>
      <nav className="platform-nav">
        <Link to="/projects" className="platform-nav__brand">
          <Shield size={16} /> AMScode
        </Link>
        <Link to="/projects" className={isActive('/projects') ? 'active' : ''}>Projects</Link>
        <Link to="/ide" className={isActive('/ide') ? 'active' : ''}>
          <Code size={12} /> IDE
        </Link>
        <NotificationCenter />
        <div className="platform-nav__user">
          <div className="platform-nav__avatar">
            {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
          </div>
          <span>{user?.name ?? 'User'}</span>
          <button className="btn btn--icon" onClick={handleLogout} title="Sign out">
            <LogOut size={14} />
          </button>
        </div>
      </nav>
      {children}
    </div>
  );
}

// ─── IDE Page (the original editor) ──────────────────────────
const RECENT_FOLDERS_KEY = 'amscode-recent-folders';

function getRecentFolders(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_FOLDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function addRecentFolder(path: string) {
  const recent = getRecentFolders().filter((p) => p !== path);
  recent.unshift(path);
  localStorage.setItem(RECENT_FOLDERS_KEY, JSON.stringify(recent.slice(0, 8)));
}

function IDEPage() {
  const { settings, updateSettings } = useSettings();
  const { compile, compileOutput, isCompiling, progress } = useCompiler(settings);

  const [projectPath, setProjectPath] = useState<string>('');
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('editor');
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [folderInput, setFolderInput] = useState('');

  // Resizable panel sizes
  const [sidebarW, setSidebarW] = useState(230);
  const [astW, setAstW] = useState(260);
  const [terminalH, setTerminalH] = useState(160);
  const dragRef = useRef<{ type: string; startX: number; startY: number; startVal: number } | null>(null);

  const currentFile = openFiles.find((f) => f.path === activeFile) ?? null;
  const recentFolders = getRecentFolders();

  // Load last opened folder on mount
  useEffect(() => {
    const last = localStorage.getItem('amscode-last-folder');
    if (last) setProjectPath(last);
  }, []);

  // Global mouse handlers for resizers
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const { type, startX, startY, startVal } = dragRef.current;
      if (type === 'sidebar') {
        setSidebarW(Math.max(140, Math.min(500, startVal + (e.clientX - startX))));
      } else if (type === 'ast') {
        setAstW(Math.max(140, Math.min(600, startVal - (e.clientX - startX))));
      } else if (type === 'terminal') {
        setTerminalH(Math.max(60, Math.min(400, startVal - (e.clientY - startY))));
      }
    };
    const onMouseUp = () => { dragRef.current = null; document.body.style.cursor = ''; document.body.style.userSelect = ''; };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); };
  }, []);

  const startDrag = (type: string, e: React.MouseEvent) => {
    e.preventDefault();
    const startVal = type === 'sidebar' ? sidebarW : type === 'ast' ? astW : terminalH;
    dragRef.current = { type, startX: e.clientX, startY: e.clientY, startVal };
    document.body.style.cursor = type === 'terminal' ? 'row-resize' : 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const openFolder = (path: string) => {
    setProjectPath(path);
    setOpenFiles([]);
    setActiveFile(null);
    setShowFolderPicker(false);
    setFolderInput('');
    addRecentFolder(path);
    localStorage.setItem('amscode-last-folder', path);
  };

  const handleShowFolderPicker = async () => {
    if (window.electronAPI) {
      const path = await window.electronAPI.openFolderDialog();
      if (path) openFolder(path);
      return;
    }
    setShowFolderPicker(true);
  };

  const handleFolderSubmit = () => {
    if (folderInput.trim()) openFolder(folderInput.trim());
  };

  const handleOpenFile = useCallback(async (path: string, name: string) => {
    if (openFiles.some((f) => f.path === path)) { setActiveFile(path); return; }
    try {
      let content = '';
      if (window.electronAPI) {
        content = await window.electronAPI.readFile(path);
      } else {
        const res = await fetch('/api/fs/readfile?path=' + encodeURIComponent(path));
        if (res.ok) { const data = await res.json(); content = data.content ?? ''; }
      }
      setOpenFiles((prev) => [...prev, { path, name, content, isDirty: false }]);
      setActiveFile(path);
    } catch {
      setOpenFiles((prev) => [...prev, { path, name, content: '', isDirty: false }]);
      setActiveFile(path);
    }
  }, [openFiles]);

  const handleFileChange = useCallback((value: string) => {
    setOpenFiles((prev) => prev.map((f) => f.path === activeFile ? { ...f, content: value, isDirty: true } : f));
  }, [activeFile]);

  const handleSave = useCallback(() => {
    if (!currentFile) return;
    if (window.electronAPI) {
      window.electronAPI.writeFile(currentFile.path, currentFile.content);
    }
    setOpenFiles((prev) => prev.map((f) => f.path === activeFile ? { ...f, isDirty: false } : f));
  }, [activeFile, currentFile]);

  const handleTabChange = useCallback((path: string) => {
    setActiveFile(path);
  }, []);

  const handleTabClose = useCallback((path: string) => {
    setOpenFiles((prev) => prev.filter((f) => f.path !== path));
    if (activeFile === path) {
      const remaining = openFiles.filter((f) => f.path !== path);
      setActiveFile(remaining.length > 0 ? remaining[remaining.length - 1].path : null);
    }
  }, [activeFile, openFiles]);

  const handleCompile = () => {
    if (currentFile) compile(currentFile.content, currentFile.path);
  };

  return (
    <div className="ide" style={{ height: 'calc(100vh - 48px)' }}>
      <Toolbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onCompile={handleCompile}
        isCompiling={isCompiling}
        hasActiveFile={!!currentFile}
        fileName={currentFile?.name}
      />

      {activeTab === 'editor' && (
        <div className="ide__body">
          {/* ── Sidebar ── */}
          <div style={{ width: sidebarW, flexShrink: 0 }}>
            <FileExplorer
              projectPath={projectPath}
              onOpenFile={handleOpenFile}
              activeFilePath={activeFile}
              onOpenFolder={handleShowFolderPicker}
              onNewFile={projectPath ? async (name: string) => {
                const filePath = projectPath.replace(/[\\/]$/, '') + '\\' + name;
                try {
                  if (window.electronAPI) {
                    await window.electronAPI.writeFile(filePath, '');
                  } else {
                    await fetch('/api/fs/writefile', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ path: filePath, content: '' }),
                    });
                  }
                  handleOpenFile(filePath, name);
                } catch {}
              } : undefined}
            />
          </div>

          {/* ── Sidebar resizer ── */}
          <div className="resizer resizer--col" onMouseDown={(e) => startDrag('sidebar', e)} />

          {/* ── Main editor area (column: top = editor+AST, bottom = terminal) ── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Top row: Editor + AST side-by-side */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
              <CodeEditor
                openFiles={openFiles}
                activeFile={activeFile}
                onFileChange={handleFileChange}
                onSave={handleSave}
                onTabChange={handleTabChange}
                onTabClose={handleTabClose}
              />
              {/* ── AST resizer ── */}
              <div className="resizer resizer--col" onMouseDown={(e) => startDrag('ast', e)} />
              <div style={{ width: astW, flexShrink: 0 }}>
                <ASTPanel source={currentFile?.content ?? ''} serverUrl={settings.serverUrl} />
              </div>
            </div>

            {/* ── Terminal resizer ── */}
            <div className="resizer resizer--row" onMouseDown={(e) => startDrag('terminal', e)} />

            {/* Output / Terminal */}
            <div style={{ height: terminalH, flexShrink: 0 }}>
              <OutputPanel compileOutput={compileOutput} isCompiling={isCompiling} progress={progress} />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'dashboard' && (
        <div style={{ flex: 1, overflow: 'auto' }}>
          <Dashboard serverUrl={settings.serverUrl} wsUrl={settings.wsUrl} />
        </div>
      )}
      {activeTab === 'settings' && (
        <div style={{ flex: 1, overflow: 'auto' }}>
          <Settings settings={settings} onSave={updateSettings} />
        </div>
      )}

      {/* Open Folder Modal (web mode only) */}
      {showFolderPicker && (
        <>
          <div className="folder-picker-backdrop" onClick={() => setShowFolderPicker(false)} />
          <div className="folder-picker-modal">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontSize: 16, color: 'var(--text-primary)' }}>
              <FolderPlus size={18} style={{ color: 'var(--teal)' }} /> Open Folder
            </h3>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input
                className="form-input"
                style={{ flex: 1, fontFamily: 'var(--font-code)', fontSize: 12 }}
                placeholder="Enter folder path (e.g. D:\projects\my-app)"
                value={folderInput}
                onChange={(e) => setFolderInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleFolderSubmit()}
                autoFocus
              />
              <button className="btn btn--primary" onClick={handleFolderSubmit}>Open</button>
            </div>
            {recentFolders.length > 0 && (
              <>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                  Recent Folders
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {recentFolders.map((p) => (
                    <button
                      key={p}
                      className="recent-folder-item"
                      onClick={() => openFolder(p)}
                    >
                      <Folder size={14} style={{ color: 'var(--orange)', flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
                        {p.split(/[\\/]/).pop()}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── App Root ────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/auth" element={<AuthPage />} />

        {/* Protected Platform */}
        <Route path="/projects" element={<RequireAuth><PlatformLayout><ProjectsPage /></PlatformLayout></RequireAuth>} />
        <Route path="/projects/:projectId" element={<RequireAuth><PlatformLayout><ProjectDashboard /></PlatformLayout></RequireAuth>} />
        <Route path="/projects/:projectId/team" element={<RequireAuth><PlatformLayout><TeamManagement /></PlatformLayout></RequireAuth>} />
        <Route path="/projects/:projectId/sources" element={<RequireAuth><PlatformLayout><LogSources /></PlatformLayout></RequireAuth>} />
        <Route path="/projects/:projectId/rules" element={<RequireAuth><PlatformLayout><RulesEditor /></PlatformLayout></RequireAuth>} />
        <Route path="/projects/:projectId/alerts" element={<RequireAuth><PlatformLayout><AlertRoutes /></PlatformLayout></RequireAuth>} />

        {/* Protected IDE */}
        <Route path="/ide" element={<RequireAuth><PlatformLayout><IDEPage /></PlatformLayout></RequireAuth>} />

        {/* Default */}
        <Route path="*" element={<Navigate to={getToken() ? '/projects' : '/auth'} replace />} />
      </Routes>
    </BrowserRouter>
  );
}
