import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiGet, apiPost, apiDelete } from '../lib/api';
import { Bell, Plus, Trash2, ArrowLeft, Mail, MessageCircle, Monitor } from 'lucide-react';

const CHANNEL_ICONS: Record<string, any> = {
  DASHBOARD: Monitor,
  EMAIL: Mail,
  SLACK: MessageCircle,
  DISCORD: MessageCircle,
};

const CHANNEL_COLORS: Record<string, string> = {
  DASHBOARD: 'var(--teal)',
  EMAIL: 'var(--orange)',
  SLACK: '#4A154B',
  DISCORD: '#5865F2',
};

export function AlertRoutes() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [routes, setRoutes] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [routeName, setRouteName] = useState('');
  const [channels, setChannels] = useState<{ channel_type: string; webhook_url: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try { setRoutes(await apiGet(`/projects/${projectId}/alerts`)); } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [projectId]);

  const addChannel = (type: string) => {
    if (channels.some((c) => c.channel_type === type)) return;
    setChannels([...channels, { channel_type: type, webhook_url: '' }]);
  };

  const updateWebhook = (idx: number, url: string) => {
    const next = [...channels];
    next[idx].webhook_url = url;
    setChannels(next);
  };

  const removeChannel = (idx: number) => {
    setChannels(channels.filter((_, i) => i !== idx));
  };

  const handleCreate = async () => {
    if (!routeName.trim()) return;
    try {
      await apiPost(`/projects/${projectId}/alerts`, { name: routeName.trim(), channels });
      setRouteName('');
      setChannels([]);
      setShowCreate(false);
      load();
    } catch {}
  };

  const handleDeleteRoute = async (id: string) => {
    if (!confirm('Delete this alert route?')) return;
    try { await apiDelete(`/projects/${projectId}/alerts/${id}`); load(); } catch {}
  };

  const handleDeleteChannel = async (routeId: string, channelId: string) => {
    try { await apiDelete(`/projects/${projectId}/alerts/${routeId}/channels/${channelId}`); load(); } catch {}
  };

  return (
    <div className="platform-page">
      <div className="platform-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn--ghost" onClick={() => navigate(`/projects/${projectId}`)}>
            <ArrowLeft size={16} />
          </button>
          <h1><Bell size={20} /> Alert Routes</h1>
        </div>
        <button className="btn btn--primary" onClick={() => setShowCreate(true)}>
          <Plus size={14} /> New Route
        </button>
      </div>

      {showCreate && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 12 }}>Create Alert Route Group</h3>
          <div className="form-group">
            <label>Group Name</label>
            <input type="text" value={routeName} onChange={(e) => setRouteName(e.target.value)} placeholder="e.g. Critical Target, Dev Team" />
          </div>

          <div className="form-group">
            <label>Add Notification Channels</label>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>Dashboard is always included by default.</p>
            <div className="channel-buttons">
              {['EMAIL', 'SLACK', 'DISCORD'].map((type) => (
                <button
                  key={type}
                  className={`btn btn--outline ${channels.some((c) => c.channel_type === type) ? 'btn--active' : ''}`}
                  onClick={() => addChannel(type)}
                >
                  {type === 'EMAIL' && <Mail size={14} />}
                  {type === 'SLACK' && <MessageCircle size={14} />}
                  {type === 'DISCORD' && <MessageCircle size={14} />}
                  {type}
                </button>
              ))}
            </div>
          </div>

          {channels.map((ch, idx) => (
            <div key={idx} className="form-group channel-input">
              <label>{ch.channel_type} {ch.channel_type === 'EMAIL' ? 'Address' : 'Webhook URL'}</label>
              <div className="form-row">
                <input
                  type={ch.channel_type === 'EMAIL' ? 'email' : 'url'}
                  value={ch.webhook_url}
                  onChange={(e) => updateWebhook(idx, e.target.value)}
                  placeholder={ch.channel_type === 'EMAIL' ? 'alerts@company.com' : 'https://hooks.slack.com/...'}
                />
                <button className="btn btn--icon btn--danger" onClick={() => removeChannel(idx)}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}

          <div className="form-row" style={{ marginTop: 12 }}>
            <button className="btn btn--primary" onClick={handleCreate}>Create Route</button>
            <button className="btn btn--ghost" onClick={() => setShowCreate(false)}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading-state">Loading...</div>
      ) : routes.length === 0 ? (
        <div className="empty-state">
          <Bell size={48} />
          <h3>No alert routes</h3>
          <p>Create an alert route to configure where notifications go.</p>
        </div>
      ) : (
        <div className="routes-list">
          {routes.map((route) => (
            <div key={route.id} className="card route-card">
              <div className="route-card__header">
                <h3>{route.name}</h3>
                <button className="btn btn--icon btn--danger" onClick={() => handleDeleteRoute(route.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="route-card__channels">
                {route.channels.map((ch: any) => {
                  const Icon = CHANNEL_ICONS[ch.channel_type] ?? Bell;
                  return (
                    <div key={ch.id} className="channel-pill">
                      <Icon size={12} style={{ color: CHANNEL_COLORS[ch.channel_type] }} />
                      <span>{ch.channel_type}</span>
                      {ch.webhook_url && <small title={ch.webhook_url}>{ch.webhook_url.slice(0, 30)}...</small>}
                      {ch.channel_type !== 'DASHBOARD' && (
                        <button className="btn btn--icon" onClick={() => handleDeleteChannel(route.id, ch.id)} style={{ padding: 0 }}>
                          <Trash2 size={10} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              {route.rule_mappings.length > 0 && (
                <div className="route-card__rules">
                  <small>Linked rules: {route.rule_mappings.map((rm: any) => rm.rule.name).join(', ')}</small>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
