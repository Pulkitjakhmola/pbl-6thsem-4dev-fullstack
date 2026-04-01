import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPatch, getToken } from '../../lib/api';
import { Bell, Check, CheckCheck, X, AlertCircle, AlertTriangle, Info } from 'lucide-react';

interface Notification {
  id: string;
  title: string;
  message: string;
  severity: string;
  is_read: boolean;
  rule_name: string | null;
  created_at: string;
}

const SEVERITY_ICON: Record<string, any> = {
  critical: AlertCircle,
  high: AlertTriangle,
  medium: AlertTriangle,
  low: Info,
  info: Info,
};

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'var(--red)',
  high: 'var(--orange)',
  medium: '#eab308',
  low: 'var(--blue)',
  info: 'var(--text-muted)',
};

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!getToken()) return;
    try {
      const data = await apiGet<{ notifications: Notification[]; unread: number }>('/notifications?limit=20');
      setNotifications(data.notifications);
      setUnread(data.unread);
    } catch {}
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000); // poll every 10s
    return () => clearInterval(interval);
  }, [load]);

  const markRead = async (id: string) => {
    try {
      await apiPatch(`/notifications/${id}/read`);
      load();
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await apiPatch('/notifications/read-all');
      load();
    } catch {}
  };

  if (!getToken()) return null;

  return (
    <div className="notification-center">
      <button className="btn btn--icon notification-bell" onClick={() => setOpen(!open)}>
        <Bell size={16} />
        {unread > 0 && <span className="notification-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <>
          <div className="notification-backdrop" onClick={() => setOpen(false)} />
          <div className="notification-dropdown">
            <div className="notification-dropdown__header">
              <span>Notifications</span>
              {unread > 0 && (
                <button className="btn btn--ghost btn--sm" onClick={markAllRead}>
                  <CheckCheck size={12} /> Mark all read
                </button>
              )}
              <button className="btn btn--icon" onClick={() => setOpen(false)} style={{ marginLeft: 'auto' }}>
                <X size={14} />
              </button>
            </div>
            <div className="notification-dropdown__list">
              {notifications.length === 0 ? (
                <div className="notification-empty">No notifications yet</div>
              ) : (
                notifications.map((n) => {
                  const SevIcon = SEVERITY_ICON[n.severity] ?? Info;
                  return (
                    <div
                      key={n.id}
                      className={`notification-item ${!n.is_read ? 'notification-item--unread' : ''}`}
                      onClick={() => !n.is_read && markRead(n.id)}
                    >
                      <SevIcon size={14} style={{ color: SEVERITY_COLOR[n.severity] ?? 'var(--text-muted)', flexShrink: 0 }} />
                      <div className="notification-item__content">
                        <div className="notification-item__title">{n.title}</div>
                        <div className="notification-item__message">{n.message}</div>
                        <div className="notification-item__meta">
                          {n.rule_name && <span className="badge badge--sm">{n.rule_name}</span>}
                          <span>{new Date(n.created_at).toLocaleString()}</span>
                        </div>
                      </div>
                      {!n.is_read && <div className="notification-dot" />}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
