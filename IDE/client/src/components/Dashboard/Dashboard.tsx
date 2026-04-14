import { useState, useEffect, useRef, useCallback } from 'react';
import { Activity, Bell, Radio, Clock } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

interface LogEntry {
  id: string;
  time: string;
  source: string;
  level: 'info' | 'warn' | 'error' | 'critical';
  message: string;
  rule?: string;
}

interface AlertEntry {
  id: string;
  time: string;
  rule: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  status: 'active' | 'resolved';
}

interface DashboardProps {
  serverUrl: string;
  wsUrl: string;
  activeSessionId?: string | null;
}

const MAX_LOG_ENTRIES = 200;
const MAX_ALERT_ENTRIES = 100;

export function Dashboard({ serverUrl, wsUrl, activeSessionId }: DashboardProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [alerts, setAlerts] = useState<AlertEntry[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [activeMonitors, setActiveMonitors] = useState(0);
  const [ruleHits, setRuleHits] = useState<{ rule: string; hits: number }[]>([]);
  const [trendData, setTrendData] = useState<{ t: string; events: number }[]>([]);
  const [deployStartTime, setDeployStartTime] = useState<number | null>(null);
  const [uptime, setUptime] = useState<string>('--');
  const wsRef = useRef<WebSocket | null>(null);
  const logStreamRef = useRef<HTMLDivElement>(null);

  // RAF-based message buffer for high-throughput WS data
  const logBufferRef = useRef<LogEntry[]>([]);
  const alertBufferRef = useRef<AlertEntry[]>([]);
  const rafIdRef = useRef<number | null>(null);

  const flushBuffers = useCallback(() => {
    rafIdRef.current = null;
    const newLogs = logBufferRef.current.splice(0);
    const newAlerts = alertBufferRef.current.splice(0);
    if (newLogs.length > 0) {
      setLogs((prev) => [...newLogs.reverse(), ...prev].slice(0, MAX_LOG_ENTRIES));
    }
    if (newAlerts.length > 0) {
      setAlerts((prev) => [...newAlerts.reverse(), ...prev].slice(0, MAX_ALERT_ENTRIES));
    }
  }, []);

  const scheduleFlush = useCallback(() => {
    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(flushBuffers);
    }
  }, [flushBuffers]);

  // Fetch sessions + stats on mount, poll every 15s
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [sessRes, statsRes] = await Promise.all([
          fetch(`${serverUrl}/api/sessions`),
          fetch(`${serverUrl}/api/ingest/stats`),
        ]);
        if (sessRes.ok) {
          const data = await sessRes.json();
          setActiveMonitors(data.sessions?.length ?? 0);
        }
        if (statsRes.ok) {
          const stats = await statsRes.json() as {
            ruleHits: { rule: string; hits: number }[];
            trendData: { t: string; events: number }[];
          };
          setRuleHits(stats.ruleHits);
          setTrendData(stats.trendData);
        }
      } catch { /* server unreachable */ }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 15000);
    return () => clearInterval(interval);
  }, [serverUrl]);

  // WebSocket connection — only connects when a real session is active
  useEffect(() => {
    if (!activeSessionId) {
      setIsLive(false);
      setLogs([]);
      setAlerts([]);
      setDeployStartTime(null);
      return;
    }

    setLogs([]);
    setAlerts([]);

    try {
      const ws = new WebSocket(`${wsUrl}/ws/runtime?sessionId=${activeSessionId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsLive(true);
        setDeployStartTime(Date.now());
      };
      ws.onclose = () => setIsLive(false);
      ws.onerror = () => setIsLive(false);

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data) as { event: string; data: unknown };

          switch (msg.event) {
            case 'log':
              logBufferRef.current.push(msg.data as LogEntry);
              scheduleFlush();
              break;

            case 'alert':
              alertBufferRef.current.push(msg.data as AlertEntry);
              scheduleFlush();
              break;

            case 'stats': {
              const stats = msg.data as {
                ruleHits: { rule: string; hits: number }[];
                trendData: { t: string; events: number }[];
              };
              setRuleHits(stats.ruleHits);
              setTrendData(stats.trendData);
              break;
            }

            // 'connected' and 'status' events are informational
            default:
              break;
          }
        } catch { /* ignore malformed messages */ }
      };
    } catch {
      setIsLive(false);
    }

    return () => {
      wsRef.current?.close();
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
    };
  }, [wsUrl, activeSessionId, scheduleFlush]);

  // Dynamic uptime counter
  useEffect(() => {
    if (!deployStartTime) { setUptime('--'); return; }
    const tick = () => {
      const elapsed = Math.floor((Date.now() - deployStartTime) / 1000);
      const h = Math.floor(elapsed / 3600);
      const m = Math.floor((elapsed % 3600) / 60);
      const s = elapsed % 60;
      setUptime(h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deployStartTime]);

  const criticalCount = alerts.filter((a) => a.severity === 'critical' && a.status === 'active').length;

  return (
    <div className="dashboard">
      <div className="dashboard__title">
        <div className="dashboard__title-dot" />
        Monitoring Dashboard
        <span style={{ fontSize:11, marginLeft:'auto' }}>
          <span className={`conn-badge conn-badge--${isLive ? 'ok' : 'err'}`}>
            <span className="conn-badge__dot" />
            {isLive ? 'Live' : activeSessionId ? 'Connecting...' : 'No Active Session'}
          </span>
        </span>
      </div>

      {/* Metric Cards */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-card__label">Active Monitors</div>
          <div className="metric-card__value metric-card__value--accent">{activeMonitors}</div>
          <div className="metric-card__sub">sources watched</div>
        </div>
        <div className="metric-card">
          <div className="metric-card__label">Rules Triggered</div>
          <div className="metric-card__value metric-card__value--orange">
            {ruleHits.reduce((a, r) => a + r.hits, 0)}
          </div>
          <div className="metric-card__sub">across {ruleHits.length} rules</div>
        </div>
        <div className="metric-card">
          <div className="metric-card__label">Alerts Today</div>
          <div className="metric-card__value metric-card__value--red">{alerts.filter((a) => a.status === 'active').length}</div>
          <div className="metric-card__sub">{criticalCount} critical</div>
        </div>
        <div className="metric-card">
          <div className="metric-card__label">Uptime</div>
          <div className="metric-card__value metric-card__value--green">{uptime}</div>
          <div className="metric-card__sub">{isLive ? 'since deploy' : 'no active session'}</div>
        </div>
      </div>

      {/* Main Grid: Log Stream + Rule Hits */}
      <div className="dashboard__grid">
        {/* Live Log Stream */}
        <div className="panel-card" style={{ gridRow: 'span 2' }}>
          <div className="panel-card__header panel-card__header--live">
            <Activity size={13} />
            Live Log Stream
            {logs.length > 0 && <span className="log-count-badge">{logs.length}</span>}
          </div>
          <div ref={logStreamRef} className="panel-card__body panel-card__body--log-stream">
            {logs.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                {activeSessionId ? 'Waiting for log output...' : 'Deploy a script to start monitoring'}
              </div>
            ) : logs.map((log) => (
              <div key={log.id} className="log-entry" style={{ padding: '4px 12px' }}>
                <span className="log-entry__time">{log.time}</span>
                <span className="log-entry__source">{log.source}</span>
                <span className={`log-badge log-badge--${log.level}`}>{log.level}</span>
                <span className="log-entry__msg">{log.message}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Rule Hits Bar Chart */}
        <div className="panel-card">
          <div className="panel-card__header">
            <Bell size={13} />
            Rule Hits
          </div>
          <div className="panel-card__body">
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={ruleHits} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="rule" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:6, fontSize:11 }}
                  labelStyle={{ color:'var(--text-primary)' }}
                />
                <Bar dataKey="hits" fill="var(--accent)" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Event Trend */}
        <div className="panel-card">
          <div className="panel-card__header">
            <Clock size={13} />
            Event Trend (last hour)
          </div>
          <div className="panel-card__body">
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart data={trendData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="accentGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--accent)"  stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--accent)"  stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="t" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                <Tooltip contentStyle={{ background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:6, fontSize:11 }} />
                <Area type="monotone" dataKey="events" stroke="var(--accent)" fill="url(#accentGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Alert History */}
      <div className="panel-card">
        <div className="panel-card__header">
          <Radio size={13} />
          Alert History
        </div>
        <div className="panel-card__body panel-card__body--alert-history">
          <table className="alert-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Rule</th>
                <th>Severity</th>
                <th>Message</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {alerts.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 16, fontSize: 12 }}>
                    {activeSessionId ? 'No alerts triggered yet' : 'Deploy a script to start monitoring'}
                  </td>
                </tr>
              ) : alerts.map((a) => (
                <tr key={a.id}>
                  <td style={{ fontFamily:'var(--font-code)', whiteSpace:'nowrap' }}>{a.time}</td>
                  <td style={{ color:'var(--accent)' }}>{a.rule}</td>
                  <td><span className={`sev-badge sev-badge--${a.severity}`}>{a.severity}</span></td>
                  <td style={{ maxWidth:300 }}>{a.message}</td>
                  <td><span className={`status-badge status-badge--${a.status}`}>{a.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
