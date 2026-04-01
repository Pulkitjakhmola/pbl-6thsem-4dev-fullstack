import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { apiGet } from '../lib/api';
import { Activity, Users, GitBranch, Bell, Shield, ArrowLeft, Settings as SettingsIcon, FileCode, Radio } from 'lucide-react';

export function ProjectDashboard() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { setProject(await apiGet(`/projects/${projectId}`)); } catch {}
      setLoading(false);
    })();
  }, [projectId]);

  if (loading) return <div className="platform-page"><div className="loading-state">Loading...</div></div>;
  if (!project) return <div className="platform-page"><div className="empty-state"><h3>Project not found</h3></div></div>;

  return (
    <div className="platform-page">
      <div className="platform-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn--ghost" onClick={() => navigate('/projects')}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1><Shield size={20} /> {project.name}</h1>
            <p>Created {new Date(project.created_at).toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card" onClick={() => navigate(`/projects/${projectId}/team`)}>
          <Users size={20} style={{ color: 'var(--blue)' }} />
          <div className="stat-card__value">{project.members.length}</div>
          <div className="stat-card__label">Team Members</div>
        </div>
        <div className="stat-card" onClick={() => navigate(`/projects/${projectId}/rules`)}>
          <Activity size={20} style={{ color: 'var(--teal)' }} />
          <div className="stat-card__value">{project.rules.length}</div>
          <div className="stat-card__label">Detection Rules</div>
        </div>
        <div className="stat-card" onClick={() => navigate(`/projects/${projectId}/sources`)}>
          <GitBranch size={20} style={{ color: 'var(--orange)' }} />
          <div className="stat-card__value">{project.sources.length}</div>
          <div className="stat-card__label">Log Sources</div>
        </div>
        <div className="stat-card" onClick={() => navigate(`/projects/${projectId}/alerts`)}>
          <Bell size={20} style={{ color: 'var(--purple)' }} />
          <div className="stat-card__value">{project.routes.length}</div>
          <div className="stat-card__label">Alert Routes</div>
        </div>
      </div>

      {/* Quick Nav Cards */}
      <div className="nav-cards">
        <Link to={`/projects/${projectId}/team`} className="nav-card">
          <Users size={24} />
          <h3>Team Management</h3>
          <p>Add or remove team members, set roles</p>
        </Link>
        <Link to={`/projects/${projectId}/sources`} className="nav-card">
          <Radio size={24} />
          <h3>Log Sources</h3>
          <p>Configure log files and data sources</p>
        </Link>
        <Link to={`/projects/${projectId}/rules`} className="nav-card">
          <FileCode size={24} />
          <h3>Detection Rules</h3>
          <p>Create rules from templates or upload scripts</p>
        </Link>
        <Link to={`/projects/${projectId}/alerts`} className="nav-card">
          <Bell size={24} />
          <h3>Alert Routes</h3>
          <p>Set up notification channels</p>
        </Link>
      </div>

      {/* Recent Rules */}
      {project.rules.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginBottom: 12 }}><Activity size={14} /> Recent Rules</h3>
          <table className="data-table">
            <thead>
              <tr><th>Name</th><th>Type</th><th>Status</th><th>Notify</th></tr>
            </thead>
            <tbody>
              {project.rules.slice(0, 5).map((rule: any) => (
                <tr key={rule.id}>
                  <td>{rule.name}</td>
                  <td><span className={`badge badge--${rule.rule_type.toLowerCase()}`}>{rule.rule_type}</span></td>
                  <td><span className={`badge badge--${rule.is_active ? 'active' : 'inactive'}`}>{rule.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td>{rule.user_mappings.length} users, {rule.route_mappings.length} routes</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
