import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiGet, apiPost, apiDelete } from '../lib/api';
import { Radio, Plus, Trash2, ArrowLeft, Key, Copy, Check, Server } from 'lucide-react';

const SOURCE_TYPES = [
  { value: 'NGINX', label: 'Nginx', icon: '🌐' },
  { value: 'APACHE', label: 'Apache', icon: '🪶' },
  { value: 'SYSLOG', label: 'Syslog', icon: '📋' },
  { value: 'CLOUDWATCH', label: 'CloudWatch', icon: '☁️' },
  { value: 'CUSTOM', label: 'Custom', icon: '⚙️' },
];

export function LogSources() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [sources, setSources] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('CUSTOM');
  const [copied, setCopied] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try { setSources(await apiGet(`/projects/${projectId}/sources`)); } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [projectId]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      await apiPost(`/projects/${projectId}/sources`, { name: name.trim(), source_type: type });
      setName('');
      setShowCreate(false);
      load();
    } catch {}
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this log source?')) return;
    try { await apiDelete(`/projects/${projectId}/sources/${id}`); load(); } catch {}
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="platform-page">
      <div className="platform-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn--ghost" onClick={() => navigate(`/projects/${projectId}`)}>
            <ArrowLeft size={16} />
          </button>
          <h1><Radio size={20} /> Log Sources</h1>
        </div>
        <button className="btn btn--primary" onClick={() => setShowCreate(true)}>
          <Plus size={14} /> Add Source
        </button>
      </div>

      {showCreate && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3><Server size={14} /> New Log Source</h3>
          <div className="form-group" style={{ marginTop: 8 }}>
            <label>Source Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Production Nginx" />
          </div>
          <div className="form-group">
            <label>Source Type</label>
            <div className="source-type-grid">
              {SOURCE_TYPES.map((st) => (
                <button
                  key={st.value}
                  className={`source-type-btn ${type === st.value ? 'source-type-btn--active' : ''}`}
                  onClick={() => setType(st.value)}
                >
                  <span style={{ fontSize: 20 }}>{st.icon}</span>
                  <span>{st.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="form-row">
            <button className="btn btn--primary" onClick={handleCreate}>Create Source</button>
            <button className="btn btn--ghost" onClick={() => setShowCreate(false)}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading-state">Loading...</div>
      ) : sources.length === 0 ? (
        <div className="empty-state">
          <Radio size={48} />
          <h3>No log sources configured</h3>
          <p>Add a log source to start monitoring.</p>
        </div>
      ) : (
        <div className="sources-list">
          {sources.map((s) => (
            <div key={s.id} className="card source-card">
              <div className="source-card__header">
                <div>
                  <h3>{s.name}</h3>
                  <span className="badge badge--source">{s.source_type}</span>
                </div>
                <button className="btn btn--icon btn--danger" onClick={() => handleDelete(s.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="source-card__key">
                <Key size={12} />
                <code>{s.api_key.slice(0, 20)}...</code>
                <button className="btn btn--icon" onClick={() => copyKey(s.api_key)} title="Copy API key">
                  {copied === s.api_key ? <Check size={12} style={{ color: 'var(--green)' }} /> : <Copy size={12} />}
                </button>
              </div>
              <div className="source-card__date">Added {new Date(s.created_at).toLocaleDateString()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
