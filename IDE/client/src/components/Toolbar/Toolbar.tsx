import { Minus, Square, X, Shield, ChevronRight, Play, Loader, Upload } from 'lucide-react';
import type { ActiveTab } from '../../App';

interface ToolbarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onCompile: () => void;
  isCompiling: boolean;
  hasActiveFile: boolean;
  fileName?: string;
}

const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

export function Toolbar({
  activeTab, onTabChange, onCompile, isCompiling, hasActiveFile, fileName,
}: ToolbarProps) {
  const handleMinimize = () => window.electronAPI?.minimize();
  const handleMaximize = () => window.electronAPI?.maximize();
  const handleClose    = () => window.electronAPI?.close();

  return (
    <div className="titlebar">
      {/* Logo */}
      <div className="titlebar__logo">
        <Shield size={16} />
        <span>AMScode</span>
      </div>

      {/* Current file breadcrumb */}
      {fileName && (
        <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, color:'var(--text-muted)' }}>
          <ChevronRight size={12} />
          <span style={{ color:'var(--text-secondary)' }}>{fileName}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="titlebar__tabs">
        {(['editor','dashboard','settings'] as ActiveTab[]).map((tab) => (
          <button
            key={tab}
            className={`titlebar__tab${activeTab === tab ? ' titlebar__tab--active' : ''}`}
            onClick={() => onTabChange(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="titlebar__spacer" />

      {/* Action buttons */}
      <div className="titlebar__actions">
        <button
          className="btn btn--compile"
          onClick={onCompile}
          disabled={!hasActiveFile || isCompiling}
          title="Compile (Ctrl+Shift+B)"
        >
          {isCompiling ? <><Loader size={12} className="spin" /> Compiling...</> : <><Play size={12} /> Compile</>}
        </button>
        <button className="btn btn--deploy" disabled={isCompiling} title="Deploy">
          <Upload size={12} /> Deploy
        </button>
      </div>

      {/* Window controls (Electron only) */}
      {isElectron && (
        <div className="win-controls">
          <button className="win-btn" onClick={handleMinimize} title="Minimize">
            <Minus size={12} />
          </button>
          <button className="win-btn" onClick={handleMaximize} title="Maximize">
            <Square size={11} />
          </button>
          <button className="win-btn win-btn--close" onClick={handleClose} title="Close">
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
