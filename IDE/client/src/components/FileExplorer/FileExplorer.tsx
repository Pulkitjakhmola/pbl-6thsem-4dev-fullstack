import { useState, useEffect, useCallback } from 'react';
import {
  Folder, FolderOpen, FileCode, File, RefreshCw, FolderPlus, FilePlus, ChevronRight, ChevronDown
} from 'lucide-react';

interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  modified?: string;
}

interface FileExplorerProps {
  projectPath: string;
  onOpenFile: (path: string, name: string) => void;
  activeFilePath: string | null;
  onOpenFolder?: () => void;
  onNewFile?: (name: string) => void;
}

interface TreeNode {
  entry: FileEntry;
  children?: TreeNode[];
  isOpen: boolean;
}

const AMS_COLORS: Record<string, string> = {
  '.ams':  'var(--accent)',
  '.json': 'var(--orange)',
  '.csv':  'var(--green)',
  '.txt':  'var(--text-secondary)',
  '.md':   'var(--blue)',
  '.g4':   'var(--purple)',
};

function getExt(name: string) { return name.includes('.') ? '.' + name.split('.').pop()! : ''; }

function FileIcon({ name, isDir }: { name: string; isDir: boolean }) {
  if (isDir) return <Folder size={14} style={{ color: 'var(--orange)' }} />;
  const ext = getExt(name);
  if (ext === '.ams') return <FileCode size={14} style={{ color: 'var(--accent)' }} />;
  return <File size={14} style={{ color: AMS_COLORS[ext] ?? 'var(--text-muted)' }} />;
}

function TreeItem({
  node, depth, onOpen, activeFilePath, onToggle,
}: {
  node: TreeNode;
  depth: number;
  onOpen: (path: string, name: string) => void;
  activeFilePath: string | null;
  onToggle: (path: string) => void;
}) {
  const { entry, isOpen, children } = node;
  const isActive = !entry.isDirectory && entry.path === activeFilePath;

  const handleClick = () => {
    if (entry.isDirectory) {
      onToggle(entry.path);
    } else {
      onOpen(entry.path, entry.name);
    }
  };

  return (
    <div className="animate-fade-in">
      <div
        className={`tree-item${entry.isDirectory ? ' tree-item--dir' : ''}${isActive ? ' tree-item--active' : ''}`}
        style={{ paddingLeft: 16 + depth * 12 }}
        onClick={handleClick}
        title={entry.path}
      >
        {entry.isDirectory ? (
          isOpen ? <ChevronDown size={10} style={{ color:'var(--text-muted)' }} /> : <ChevronRight size={10} style={{ color:'var(--text-muted)' }} />
        ) : (
          <span style={{ width: 10 }} />
        )}
        <FileIcon name={entry.name} isDir={entry.isDirectory} />
        <span style={{ overflow:'hidden', textOverflow:'ellipsis' }}>{entry.name}</span>
      </div>
      {entry.isDirectory && isOpen && children && (
        <div>
          {children.map((child) => (
            <TreeItem
              key={child.entry.path}
              node={child}
              depth={depth + 1}
              onOpen={onOpen}
              activeFilePath={activeFilePath}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FileExplorer({ projectPath, onOpenFile, activeFilePath, onOpenFolder, onNewFile }: FileExplorerProps) {
  const [nodes, setNodes] = useState<TreeNode[]>([]);
  const [openDirs, setOpenDirs] = useState<Set<string>>(new Set([projectPath]));
  const [isLoading, setIsLoading] = useState(false);
  const [showNewFileInput, setShowNewFileInput] = useState(false);
  const [newFileName, setNewFileName] = useState('');

  const loadDir = useCallback(async (path: string): Promise<FileEntry[]> => {
    if (window.electronAPI) {
      return window.electronAPI.readDir(path);
    }
    // Web mode: fetch from backend
    const res = await fetch('/api/fs/readdir?path=' + encodeURIComponent(path));
    return res.ok ? res.json() : [];
  }, []);

  const buildTree = useCallback(async (path: string, open: Set<string>): Promise<TreeNode[]> => {
    try {
      const entries = await loadDir(path);
      const sorted = entries.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      return await Promise.all(
        sorted.map(async (entry) => {
          const node: TreeNode = {
            entry,
            isOpen: open.has(entry.path),
            children: undefined,
          };
          if (entry.isDirectory && open.has(entry.path)) {
            node.children = await buildTree(entry.path, open);
          }
          return node;
        })
      );
    } catch {
      return [];
    }
  }, [loadDir]);

  const refresh = useCallback(async () => {
    if (!projectPath) return;
    setIsLoading(true);
    const tree = await buildTree(projectPath, openDirs);
    setNodes(tree);
    setIsLoading(false);
  }, [projectPath, openDirs, buildTree]);

  useEffect(() => {
    setOpenDirs(new Set([projectPath]));
  }, [projectPath]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleToggle = useCallback(async (path: string) => {
    setOpenDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path); else next.add(path);
      return next;
    });
  }, []);

  const handleNewFileSubmit = () => {
    const trimmed = newFileName.trim();
    if (trimmed && onNewFile) {
      onNewFile(trimmed);
      setNewFileName('');
      setShowNewFileInput(false);
      // Refresh after a short delay to pick up the new file
      setTimeout(refresh, 300);
    }
  };

  const handleNewFileCancel = () => {
    setNewFileName('');
    setShowNewFileInput(false);
  };

  // No project open
  if (!projectPath) {
    return (
      <aside className="sidebar">
        <div className="sidebar__header">
          <FolderOpen size={12} />
          <span>Explorer</span>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20 }}>
          <FolderPlus size={36} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
          <span style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>No folder open</span>
          {onOpenFolder && (
            <button className="btn btn--primary" style={{ fontSize: 11, padding: '6px 14px' }} onClick={onOpenFolder}>
              <FolderPlus size={12} /> Open Folder
            </button>
          )}
        </div>
      </aside>
    );
  }

  return (
    <aside className="sidebar">
      <div className="sidebar__header">
        <FolderOpen size={12} />
        <span>Explorer</span>
        <span style={{ flex:1 }} />
        {onOpenFolder && (
          <button className="btn btn--icon" onClick={onOpenFolder} title="Open Folder" style={{ padding:2 }}>
            <FolderPlus size={12} />
          </button>
        )}
        {onNewFile && (
          <button className="btn btn--icon" onClick={() => {
            setShowNewFileInput(true);
            setNewFileName('');
          }} title="New File" style={{ padding:2 }}>
            <FilePlus size={12} />
          </button>
        )}
        <button className="btn btn--icon" onClick={refresh} title="Refresh" style={{ padding:2 }}>
          <RefreshCw size={12} className={isLoading ? 'spin' : ''} />
        </button>
      </div>

      {/* Inline new-file input (replaces broken window.prompt in Electron) */}
      {showNewFileInput && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '4px 8px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-secondary)',
        }}>
          <FilePlus size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <input
            autoFocus
            type="text"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleNewFileSubmit();
              if (e.key === 'Escape') handleNewFileCancel();
            }}
            onBlur={handleNewFileCancel}
            placeholder="filename.ams"
            style={{
              flex: 1,
              background: 'var(--bg-primary)',
              border: '1px solid var(--accent)',
              borderRadius: 3,
              color: 'var(--text-primary)',
              fontSize: 11,
              padding: '3px 6px',
              outline: 'none',
              fontFamily: 'var(--font-code)',
            }}
          />
        </div>
      )}

      {/* Project root label */}
      <div className="tree-item tree-item--dir" style={{ paddingLeft: 8, borderBottom: '1px solid var(--border)' }}>
        <FolderOpen size={14} style={{ color:'var(--orange)' }} />
        <span style={{ overflow:'hidden', textOverflow:'ellipsis', fontSize:11 }}>
          {projectPath.split(/[\\/]/).pop()}
        </span>
      </div>

      <div className="sidebar__tree">
        {nodes.map((node) => (
          <TreeItem
            key={node.entry.path}
            node={node}
            depth={0}
            onOpen={onOpenFile}
            activeFilePath={activeFilePath}
            onToggle={handleToggle}
          />
        ))}
        {nodes.length === 0 && !isLoading && (
          <div style={{ padding:12, fontSize:11, color:'var(--text-muted)', textAlign:'center' }}>
            No files found
          </div>
        )}
      </div>
    </aside>
  );
}

