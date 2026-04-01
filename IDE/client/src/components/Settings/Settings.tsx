import { useState } from 'react';
import { Settings as SettingsIcon, Binary, Link, Sliders, Bell, Check } from 'lucide-react';
import type { AppSettings } from '../../hooks/useSettings';

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

      {/* Compiler Settings */}
      <div className="settings-section">
        <div className="settings-section__header">
          <Binary size={14} />
          Compiler Settings
        </div>
        <div className="settings-section__body">
          <div className="form-row">
            <label className="form-label">Compiler Path (ams.exe)</label>
            <div className="form-input--with-btn">
              <input
                className="form-input"
                value={local.compilerPath}
                onChange={(e) => set('compilerPath', e.target.value)}
                spellCheck={false}
              />
              <button className="btn btn--ghost" onClick={handleBrowse}>Browse</button>
            </div>
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
            <input className="form-input" value={local.slackWebhook} onChange={(e) => set('slackWebhook', e.target.value)} placeholder="https://hooks.slack.com/…" />
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
