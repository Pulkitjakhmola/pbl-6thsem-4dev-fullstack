import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPost, apiDelete, getStoredUser } from '../lib/api';
import { FolderPlus, Trash2, Users, Shield, Activity, GitBranch, Plus } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  created_at: string;
  members: { user: { id: string; name: string; email: string }; project_role: string }[];
  _count: { rules: number; sources: number; routes: number };
}

export function ProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);
  const user = getStoredUser();

  const load = async () => {
    setLoading(true);
    try { setProjects(await apiGet('/projects')); } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await apiPost('/projects', { name: newName.trim() });
      setNewName('');
      setShowCreate(false);
      load();
    } catch {}
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this project and all its data?')) return;
    try { await apiDelete(`/projects/${id}`); load(); } catch {}
  };

  return (
    <div className="platform-page">
      <div className="platform-header">
        <div>
          <h1><Shield size={24} /> My Projects</h1>
          <p>Welcome back, {user?.name ?? 'User'}</p>
        </div>
        <button className="btn btn--primary" onClick={() => setShowCreate(true)}>
          <Plus size={14} /> New Project
        </button>
      </div>

      {showCreate && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="form-row">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Project name (e.g. Production Monitoring)"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
            <button className="btn btn--primary" onClick={handleCreate}>Create</button>
            <button className="btn btn--ghost" onClick={() => setShowCreate(false)}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading-state">Loading projects...</div>
      ) : projects.length === 0 ? (
        <div className="empty-state">
          <FolderPlus size={48} />
          <h3>No projects yet</h3>
          <p>Create your first monitoring project to get started.</p>
          <button className="btn btn--primary" onClick={() => setShowCreate(true)}>
            <Plus size={14} /> Create Project
          </button>
        </div>
      ) : (
        <div className="projects-grid">
          {projects.map((p) => (
            <div key={p.id} className="card project-card" onClick={() => navigate(`/projects/${p.id}`)}>
              <div className="project-card__header">
                <h3>{p.name}</h3>
                <button
                  className="btn btn--icon btn--danger"
                  onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                  title="Delete project"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="project-card__stats">
                <span><Users size={12} /> {p.members.length} members</span>
                <span><Activity size={12} /> {p._count.rules} rules</span>
                <span><GitBranch size={12} /> {p._count.sources} sources</span>
              </div>
              <div className="project-card__date">
                Created {new Date(p.created_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
