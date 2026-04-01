import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiGet, apiPost, apiPatch, apiDelete } from '../lib/api';
import { Users, UserPlus, Trash2, ArrowLeft, Crown, Eye } from 'lucide-react';

export function TeamManagement() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [members, setMembers] = useState<any[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('VIEWER');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const project = await apiGet<any>(`/projects/${projectId}`);
      setMembers(project.members);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [projectId]);

  const handleAdd = async () => {
    setError('');
    if (!email.trim()) return;
    try {
      await apiPost(`/projects/${projectId}/members`, { email: email.trim(), role });
      setEmail('');
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await apiPatch(`/projects/${projectId}/members/${userId}`, { role: newRole });
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleRemove = async (userId: string, name: string) => {
    if (!confirm(`Remove ${name} from this project?`)) return;
    try {
      await apiDelete(`/projects/${projectId}/members/${userId}`);
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="platform-page">
      <div className="platform-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn--ghost" onClick={() => navigate(`/projects/${projectId}`)}>
            <ArrowLeft size={16} />
          </button>
          <h1><Users size={20} /> Team Management</h1>
        </div>
      </div>

      {/* Add Member */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3><UserPlus size={14} /> Add Team Member</h3>
        <div className="form-row" style={{ marginTop: 8 }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter email address"
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="VIEWER">Viewer</option>
            <option value="ADMIN">Admin</option>
          </select>
          <button className="btn btn--primary" onClick={handleAdd}>Add</button>
        </div>
        {error && <div className="auth-error" style={{ marginTop: 8 }}>{error}</div>}
      </div>

      {/* Members List */}
      <div className="card">
        <h3 style={{ marginBottom: 12 }}>Current Members ({members.length})</h3>
        {loading ? (
          <div className="loading-state">Loading...</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Name</th><th>Email</th><th>Role</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.user.id}>
                  <td style={{ fontWeight: 500 }}>{m.user.name}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{m.user.email}</td>
                  <td>
                    <select
                      value={m.project_role}
                      onChange={(e) => handleRoleChange(m.user.id, e.target.value)}
                      className="role-select"
                    >
                      <option value="ADMIN">Admin</option>
                      <option value="VIEWER">Viewer</option>
                    </select>
                    {m.project_role === 'ADMIN' ? (
                      <Crown size={12} style={{ color: 'var(--orange)', marginLeft: 4 }} />
                    ) : (
                      <Eye size={12} style={{ color: 'var(--text-muted)', marginLeft: 4 }} />
                    )}
                  </td>
                  <td>
                    <button className="btn btn--icon btn--danger" onClick={() => handleRemove(m.user.id, m.user.name)}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
