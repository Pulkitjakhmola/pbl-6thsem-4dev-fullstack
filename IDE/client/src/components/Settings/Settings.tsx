import { useState } from 'react';
import { Settings as SettingsIcon, Binary, Link, Sliders, Bell, Check, Layers } from 'lucide-react';
import type { AppSettings } from '../../hooks/useSettings';
import { LANGUAGE_PRESETS } from '../../hooks/useSettings';

interface SettingsProps {
  settings: AppSettings;
  onSave: (s: AppSettings) => void;
}

export function Settings({ settings, onSave }: SettingsProps) {
  const [local, setLocal] = useState<AppSettings>({ ...settings });
  const [saved, setSaved] = useState(false);

  const set = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
    setLocal((prev) => ({ ...prev, [key]: value }));

  const handleSave = () => {
    onSave(local);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleBrowse = async () => {
    if (window.electronAPI) {
      const path = await window.electronAPI.openFileDialog();
      if (path) set('compilerPath', path);
    }
  };

  const handleFolderBrowse = async () => {
    if (window.electronAPI) {
      const path = await window.electronAPI.openFolderDialog();
      if (path) set('projectPath', path);
    }
  };

  const applyPreset = (idx: number) => {
    const preset = LANGUAGE_PRESETS[idx];
    if (!preset) return;
    setLocal((prev) => ({
      ...prev,
      compilerPath: preset.compilerPath,
      compileCommand: preset.compileCommand,
      fileExtension: preset.fileExtension,
      languageName: preset.languageName,
      grammarPath: preset.grammarPath,
      astCommandFlag: preset.astCommandFlag,
    }));
  };

  const testConnection = async () => {
    try {
      const res = await fetch(`${local.serverUrl}/api/health`);
      if (res.ok) alert('Connected to backend successfully.');
      else alert('Backend returned ' + res.status);
    } catch {
      alert('Cannot reach backend at ' + local.serverUrl);
    }
  };

  return (
    <div className="settings">
      <div className="settings__title">
        <SettingsIcon size={20} style={{ color: 'var(--accent)' }} />
        Settings
      </div>

      {/* Language Preset */}
      <div className="settings-section">
        <div className="settings-section__header">
          <Layers size={14} />
          Language / Compiler Preset
        </div>
        <div className="settings-section__body">
          <div className="form-row">
            <label className="form-label">Quick Setup</label>
            <select
              className="form-input"
              onChange={(e) => applyPreset(parseInt(e.target.value, 10))}
              defaultValue=""
              style={{ cursor: 'pointer' }}
            >
              <option value="" disabled>
                -- Select a preset to auto-fill settings --
              </option>
              {LANGUAGE_PRESETS.map((p, i) => (
                <option key={i} value={i}>{p.label}</option>
              ))}
            </select>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              Selecting a preset fills in the compiler fields below. You can still customize them after.
            </span>
          </div>
        </div>
      </div>

      {/* Compiler Settings */}
      <div className="settings-section">
        <div className="settings-section__header">
          <Binary size={14} />
          Compiler Settings
        </div>
        <div className="settings-section__body">
          <div className="form-row">
            <label className="form-label">Language Name</label>
            <input
              className="form-input"
              value={local.languageName}
              onChange={(e) => set('languageName', e.target.value)}
              placeholder="e.g. AMS, C, Python"
              spellCheck={false}
            />
          </div>
          <div className="form-row">
            <label className="form-label">File Extension</label>
            <input
              className="form-input"
              value={local.fileExtension}
              onChange={(e) => set('fileExtension', e.target.value)}
              placeholder=".ams, .c, .py, etc."
              spellCheck={false}
              style={{ width: 120 }}
            />
          </div>
          <div className="form-row">
            <label className="form-label">Compiler / Interpreter Path</label>
            <div className="form-input--with-btn">
              <input
                className="form-input"
                value={local.compilerPath}
                onChange={(e) => set('compilerPath', e.target.value)}
                placeholder="e.g. gcc, python, /path/to/compiler"
                spellCheck={false}
              />
              <button className="btn btn--ghost" onClick={handleBrowse}>Browse</button>
            </div>
          </div>
          <div className="form-row">
            <label className="form-label">Compile Command</label>
            <input
              className="form-input"
              value={local.compileCommand}
              onChange={(e) => set('compileCommand', e.target.value)}
              placeholder="build {FILE}"
              spellCheck={false}
            />
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              Use <code style={{ color: 'var(--accent)' }}>{'{FILE}'}</code> as a placeholder for the source file path.
              Example: <code style={{ color: 'var(--text-secondary)' }}>build {'{FILE}'}</code> or <code style={{ color: 'var(--text-secondary)' }}>-o {'{FILE}'}.out {'{FILE}'}</code>
            </span>
          </div>
          <div className="form-row">
            <label className="form-label">Project / Workspace Path</label>
            <div className="form-input--with-btn">
              <input
                className="form-input"
                value={local.projectPath}
                onChange={(e) => set('projectPath', e.target.value)}
                spellCheck={false}
              />
              <button className="btn btn--ghost" onClick={handleFolderBrowse}>Browse</button>
            </div>
          </div>
          <div className="form-row form-row--inline">
            <label className="form-label">Verbose Output</label>
            <label className="toggle">
              <input type="checkbox" checked={local.verboseCompiler} onChange={(e) => set('verboseCompiler', e.target.checked)} />
              <span className="toggle__slider" />
            </label>
          </div>
          <div className="form-row">
            <label className="form-label">Grammar Path (Monarch JSON)</label>
            <input
              className="form-input"
              value={local.grammarPath}
              onChange={(e) => set('grammarPath', e.target.value)}
              placeholder="Optional -- path to custom Monarch grammar JSON"
              spellCheck={false}
            />
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              For common languages (C, Python, JS, etc.) Monaco has built-in highlighting -- no grammar file needed.
            </span>
          </div>
          <div className="form-row">
            <label className="form-label">AST Command Flag</label>
            <input
              className="form-input"
              value={local.astCommandFlag}
              onChange={(e) => set('astCommandFlag', e.target.value)}
              placeholder="Optional -- e.g. --dump-ast"
              spellCheck={false}
            />
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              If your compiler supports dumping AST to stdout, set the flag here. Otherwise the built-in parser is used.
            </span>
          </div>
        </div>
      </div>

      {/* Backend Connection */}
      <div className="settings-section">
        <div className="settings-section__header">
          <Link size={14} />
          Backend Connection
        </div>
        <div className="settings-section__body">
          <div className="form-row">
            <label className="form-label">Server URL</label>
            <div className="form-input--with-btn">
              <input className="form-input" value={local.serverUrl} onChange={(e) => set('serverUrl', e.target.value)} />
              <button className="btn btn--ghost" onClick={testConnection}>Test</button>
            </div>
          </div>
          <div className="form-row">
            <label className="form-label">WebSocket URL</label>
            <input className="form-input" value={local.wsUrl} onChange={(e) => set('wsUrl', e.target.value)} />
          </div>
        </div>
      </div>

      {/* Editor Preferences */}
      <div className="settings-section">
        <div className="settings-section__header">
          <Sliders size={14} />
          Editor Preferences
        </div>
        <div className="settings-section__body">
          <div className="form-row form-row--inline">
            <label className="form-label">Font Size</label>
            <input
              className="form-input"
              type="number"
              min={10} max={24}
              value={local.fontSize}
              onChange={(e) => set('fontSize', parseInt(e.target.value, 10))}
              style={{ width: 70 }}
            />
          </div>
          <div className="form-row form-row--inline">
            <label className="form-label">Real-time AST Parsing</label>
            <label className="toggle">
              <input type="checkbox" checked={local.liveAST} onChange={(e) => set('liveAST', e.target.checked)} />
              <span className="toggle__slider" />
            </label>
          </div>
          <div className="form-row form-row--inline">
            <label className="form-label">Autocomplete</label>
            <label className="toggle">
              <input type="checkbox" checked={local.autocomplete} onChange={(e) => set('autocomplete', e.target.checked)} />
              <span className="toggle__slider" />
            </label>
          </div>
          <div className="form-row form-row--inline">
            <label className="form-label">Error Highlighting</label>
            <label className="toggle">
              <input type="checkbox" checked={local.errorHighlighting} onChange={(e) => set('errorHighlighting', e.target.checked)} />
              <span className="toggle__slider" />
            </label>
          </div>
        </div>
      </div>

      {/* Notification Channels */}
      <div className="settings-section">
        <div className="settings-section__header">
          <Bell size={14} />
          Notification Channels
        </div>
        <div className="settings-section__body">
          <div className="form-row">
            <label className="form-label">Alert Email</label>
            <input className="form-input" type="email" value={local.alertEmail} onChange={(e) => set('alertEmail', e.target.value)} placeholder="security@company.com" />
          </div>
          <div className="form-row">
            <label className="form-label">Slack Webhook URL</label>
            <input className="form-input" value={local.slackWebhook} onChange={(e) => set('slackWebhook', e.target.value)} placeholder="https://hooks.slack.com/..." />
          </div>
          <div className="form-row">
            <label className="form-label">API Endpoint</label>
            <input className="form-input" value={local.apiEndpoint} onChange={(e) => set('apiEndpoint', e.target.value)} placeholder="https://api.example.com/alerts" />
          </div>
        </div>
      </div>

      <div className="settings__footer">
        <button className="btn btn--ghost" onClick={() => setLocal({ ...settings })}>Reset</button>
        <button className="btn btn--primary" onClick={handleSave}>
          {saved ? <><Check size={12} /> Saved</> : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
