import { useState, useEffect, useRef } from 'react';
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
}

// Demo seed data shown when no real session is active
const DEMO_LOGS: LogEntry[] = [
  { id:'1', time:'14:23:01', source:'auth.log', level:'warn',     message:'Failed login attempt from 192.168.1.45', rule:'BruteForceDetection' },
  { id:'2', time:'14:23:05', source:'auth.log', level:'warn',     message:'Failed login attempt from 192.168.1.45', rule:'BruteForceDetection' },
  { id:'3', time:'14:23:12', source:'query.log',level:'error',    message:'Suspicious SQL pattern detected: SELECT * FROM users', rule:'SQLInjection' },
  { id:'4', time:'14:23:18', source:'auth.log', level:'error',    message:'FAILED_LOGIN count exceeded threshold (5)', rule:'BruteForceDetection' },
  { id:'5', time:'14:23:30', source:'net.log',  level:'info',     message:'Connection from 10.0.0.1 port 443', rule: undefined },
  { id:'6', time:'14:23:44', source:'auth.log', level:'critical', message:'Brute force attack confirmed — BLOCK_IP triggered', rule:'BruteForceDetection' },
  { id:'7', time:'14:24:02', source:'app.log',  level:'info',     message:'Monitoring cycle completed, 3 rules checked', rule: undefined },
];

const DEMO_ALERTS: AlertEntry[] = [
  { id:'1', time:'14:23:44', rule:'BruteForceDetection', severity:'high',     message:'Brute force attack from 192.168.1.45', status:'active' },
  { id:'2', time:'14:23:12', rule:'SQLInjection',        severity:'critical',  message:'SQL injection pattern in query.log', status:'active' },
  { id:'3', time:'14:10:00', rule:'PortScan',            severity:'medium',    message:'Port scan detected from 10.0.0.99', status:'resolved' },
  { id:'4', time:'13:55:00', rule:'UnauthorizedAccess',  severity:'low',       message:'ACCESS_DENIED without credentials', status:'resolved' },
];

const RULE_HITS = [
  { rule:'BruteForce', hits:5 },
  { rule:'SQLInjection', hits:2 },
  { rule:'PortScan', hits:8 },
  { rule:'Malware', hits:1 },
  { rule:'Unauthorized', hits:3 },
];

const TREND_DATA = Array.from({ length: 12 }, (_, i) => ({
  t: `${i * 5}m`, events: Math.floor(Math.random() * 20 + 2),
}));

export function Dashboard({ serverUrl, wsUrl }: DashboardProps) {
  const [logs, setLogs] = useState<LogEntry[]>(DEMO_LOGS);
  const [alerts, setAlerts] = useState<AlertEntry[]>(DEMO_ALERTS);
  const [isLive, setIsLive] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Attempt WS connection
  useEffect(() => {
    const sessionId = 'demo-' + Date.now();
    try {
      const ws = new WebSocket(`${wsUrl}/ws/runtime?sessionId=${sessionId}`);
      wsRef.current = ws;
      ws.onopen  = () => setIsLive(true);
      ws.onclose = () => setIsLive(false);
      ws.onerror = () => setIsLive(false);
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data) as { event: string; data: LogEntry };
          if (msg.event === 'log') {
            setLogs((prev) => [msg.data, ...prev].slice(0, 100));
          }
        } catch { /* ignore */ }
      };
    } catch { setIsLive(false); }
    return () => { wsRef.current?.close(); };
  }, [wsUrl]);

  const criticalCount = alerts.filter((a) => a.severity === 'critical' && a.status === 'active').length;
  const activeMonitors = 3; // would come from /api/sessions in a full impl

  return (
    <div className="dashboard">
      <div className="dashboard__title">
        <div className="dashboard__title-dot" />
        Monitoring Dashboard
        <span style={{ fontSize:11, marginLeft:'auto' }}>
          <span className={`conn-badge conn-badge--${isLive ? 'ok' : 'err'}`}>
            <span className="conn-badge__dot" />
            {isLive ? 'Live' : 'Demo Mode'}
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
            {RULE_HITS.reduce((a, r) => a + r.hits, 0)}
          </div>
          <div className="metric-card__sub">across {RULE_HITS.length} rules</div>
        </div>
        <div className="metric-card">
          <div className="metric-card__label">Alerts Today</div>
          <div className="metric-card__value metric-card__value--red">{alerts.filter((a) => a.status === 'active').length}</div>
          <div className="metric-card__sub">{criticalCount} critical</div>
        </div>
        <div className="metric-card">
          <div className="metric-card__label">Uptime</div>
          <div className="metric-card__value metric-card__value--green">99.2%</div>
          <div className="metric-card__sub">last 24 hours</div>
        </div>
      </div>

      {/* Main Grid: Log Stream + Rule Hits */}
      <div className="dashboard__grid">
        {/* Live Log Stream */}
        <div className="panel-card" style={{ gridRow: 'span 2' }}>
          <div className="panel-card__header panel-card__header--live">
            <Activity size={13} />
            Live Log Stream
          </div>
          <div className="panel-card__body" style={{ padding: 0 }}>
            {logs.map((log) => (
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
              <BarChart data={RULE_HITS} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
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
              <AreaChart data={TREND_DATA} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
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
        <div className="panel-card__body" style={{ padding: 0 }}>
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
              {alerts.map((a) => (
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
