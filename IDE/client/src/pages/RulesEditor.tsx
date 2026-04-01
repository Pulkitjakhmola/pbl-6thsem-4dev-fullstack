import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiGet, apiPost, apiDelete } from '../lib/api';
import { Activity, Plus, Trash2, ArrowLeft, FileCode, Cpu, Upload, Users, Bell } from 'lucide-react';

export function RulesEditor() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [rules, setRules] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [alertRoutes, setAlertRoutes] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [mode, setMode] = useState<'template' | 'script'>('template');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [ruleName, setRuleName] = useState('');
  const [notifyUsers, setNotifyUsers] = useState<string[]>([]);
  const [notifyRoutes, setNotifyRoutes] = useState<string[]>([]);
  const [scriptFile, setScriptFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [r, t, p, ar] = await Promise.all([
        apiGet<any[]>(`/projects/${projectId}/rules`),
        apiGet<any[]>('/rules/templates'),
        apiGet<any>(`/projects/${projectId}`),
        apiGet<any[]>(`/projects/${projectId}/alerts`),
      ]);
      setRules(r);
      setTemplates(t);
      setMembers(p.members);
      setAlertRoutes(ar);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [projectId]);

  const handleCreate = async () => {
    if (!ruleName.trim()) return;
    try {
      const body: any = {
        name: ruleName.trim(),
        rule_type: mode === 'script' ? 'SCRIPT' : 'GUI',
        notify_users: notifyUsers,
        notify_routes: notifyRoutes,
      };
      if (mode === 'template' && selectedTemplate) {
        body.template_id = selectedTemplate;
        const tmpl = templates.find((t) => t.id === selectedTemplate);
        body.condition_logic = tmpl?.condition_logic;
      }

      const rule = await apiPost<any>(`/projects/${projectId}/rules`, body);

      // If script mode and file selected, upload it
      if (mode === 'script' && scriptFile) {
        const fd = new FormData();
        fd.append('script', scriptFile);
        await apiPost(`/projects/${projectId}/rules/${rule.id}/upload`, fd);
      }

      setRuleName('');
      setSelectedTemplate('');
      setNotifyUsers([]);
      setNotifyRoutes([]);
      setScriptFile(null);
      setShowCreate(false);
      load();
    } catch {}
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this detection rule?')) return;
    try { await apiDelete(`/projects/${projectId}/rules/${id}`); load(); } catch {}
  };

  const toggleUser = (uid: string) => {
    setNotifyUsers((prev) => prev.includes(uid) ? prev.filter((u) => u !== uid) : [...prev, uid]);
  };

  const toggleRoute = (rid: string) => {
    setNotifyRoutes((prev) => prev.includes(rid) ? prev.filter((r) => r !== rid) : [...prev, rid]);
  };

  return (
    <div className="platform-page">
      <div className="platform-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn--ghost" onClick={() => navigate(`/projects/${projectId}`)}>
            <ArrowLeft size={16} />
          </button>
          <h1><Activity size={20} /> Detection Rules</h1>
        </div>
        <button className="btn btn--primary" onClick={() => setShowCreate(true)}>
          <Plus size={14} /> New Rule
        </button>
      </div>

      {showCreate && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 12 }}>Create Detection Rule</h3>

          {/* Mode Toggle */}
          <div className="auth-tabs" style={{ marginBottom: 12 }}>
            <button className={`auth-tab ${mode === 'template' ? 'auth-tab--active' : ''}`} onClick={() => setMode('template')}>
              <Cpu size={14} /> From Template
            </button>
            <button className={`auth-tab ${mode === 'script' ? 'auth-tab--active' : ''}`} onClick={() => setMode('script')}>
              <Upload size={14} /> Upload Script
            </button>
          </div>

          <div className="form-group">
            <label>Rule Name</label>
            <input type="text" value={ruleName} onChange={(e) => setRuleName(e.target.value)} placeholder="e.g. Brute Force Alert" />
          </div>

          {mode === 'template' ? (
            <div className="form-group">
              <label>Select Template</label>
              <div className="template-grid">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    className={`template-card ${selectedTemplate === t.id ? 'template-card--active' : ''}`}
                    onClick={() => setSelectedTemplate(t.id)}
                  >
                    <Cpu size={16} />
                    <strong>{t.name}</strong>
                    <small>{t.description}</small>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="form-group">
              <label>Upload .ams Script</label>
              <input
                type="file"
                accept=".ams"
                onChange={(e) => setScriptFile(e.target.files?.[0] ?? null)}
                className="file-input"
              />
              {scriptFile && <small style={{ color: 'var(--teal)' }}>Selected: {scriptFile.name}</small>}
            </div>
          )}

          {/* Notify Users */}
          <div className="form-group">
            <label><Users size={12} /> Notify Users (on event detection)</label>
            <div className="chip-list">
              {members.map((m) => (
                <button
                  key={m.user.id}
                  className={`chip ${notifyUsers.includes(m.user.id) ? 'chip--active' : ''}`}
                  onClick={() => toggleUser(m.user.id)}
                >
                  {m.user.name}
                </button>
              ))}
            </div>
          </div>

          {/* Notify Routes */}
          {alertRoutes.length > 0 && (
            <div className="form-group">
              <label><Bell size={12} /> Alert Routes</label>
              <div className="chip-list">
                {alertRoutes.map((r) => (
                  <button
                    key={r.id}
                    className={`chip ${notifyRoutes.includes(r.id) ? 'chip--active' : ''}`}
                    onClick={() => toggleRoute(r.id)}
                  >
                    {r.name} ({r.channels.length} channels)
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="form-row" style={{ marginTop: 12 }}>
            <button className="btn btn--primary" onClick={handleCreate}>Create Rule</button>
            <button className="btn btn--ghost" onClick={() => setShowCreate(false)}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading-state">Loading...</div>
      ) : rules.length === 0 ? (
        <div className="empty-state">
          <Activity size={48} />
          <h3>No detection rules</h3>
          <p>Create a rule from a template or upload a .ams script.</p>
        </div>
      ) : (
        <div className="rules-list">
          {rules.map((rule) => (
            <div key={rule.id} className="card rule-card">
              <div className="rule-card__header">
                <div>
                  <h3>{rule.name}</h3>
                  <div className="rule-card__badges">
                    <span className={`badge badge--${rule.rule_type.toLowerCase()}`}>
                      {rule.rule_type === 'GUI' ? <Cpu size={10} /> : <FileCode size={10} />}
                      {rule.rule_type}
                    </span>
                    <span className={`badge badge--${rule.is_active ? 'active' : 'inactive'}`}>
                      {rule.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                <button className="btn btn--icon btn--danger" onClick={() => handleDelete(rule.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="rule-card__meta">
                <span><Users size={12} /> {rule.user_mappings.length} notified users</span>
                <span><Bell size={12} /> {rule.route_mappings.length} alert routes</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
