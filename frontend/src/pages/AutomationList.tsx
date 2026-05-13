import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAutomations, toggleAutomation, deleteAutomation } from '../api/client';
import { Automation } from '../types';
import StatusBadge from '../components/StatusBadge';

interface Props { workspaceId: string; }

const AutomationList: React.FC<Props> = ({ workspaceId }) => {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const navigate = useNavigate();

  const load = async () => {
    try {
      setLoading(true);
      const data = await getAutomations(workspaceId);
      setAutomations(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [workspaceId]);

  const handleToggle = async (id: string, current: boolean) => {
    try {
      await toggleAutomation(id, !current);
      setAutomations(prev => prev.map(a => a.id === id ? { ...a, is_active: !current } : a));
    } catch { alert('Failed to toggle'); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    try {
      await deleteAutomation(id);
      setAutomations(prev => prev.filter(a => a.id !== id));
    } catch { alert('Failed to delete'); }
  };

  if (loading) return <div style={s.center}>⏳ Loading automations...</div>;

  if (error) return (
    <div style={s.center}>
      <div style={{ fontSize:48, marginBottom:16 }}>⚠️</div>
      <h3 style={{ color:'#172B4D' }}>Connection Error</h3>
      <p style={{ color:'#6B778C' }}>{error}</p>
      <a href="http://localhost:3000/oauth/start" style={s.btn}>🔗 Connect to monday.com</a>
    </div>
  );

  return (
    <div style={s.container}>
      <div style={s.topBar}>
        <div>
          <h2 style={s.title}>My Automations</h2>
          <p style={s.subtitle}>{automations.length} automation{automations.length !== 1 ? 's' : ''}</p>
        </div>
        <button style={s.btn} onClick={() => navigate('/builder')}>+ New Automation</button>
      </div>

      {automations.length === 0 && (
        <div style={s.empty}>
          <div style={{ fontSize:48, marginBottom:16 }}>⚡</div>
          <h3>No automations yet</h3>
          <p style={{ color:'#6B778C' }}>Create your first cross-board automation</p>
          <button style={s.btn} onClick={() => navigate('/builder')}>+ Create Automation</button>
        </div>
      )}

      {automations.map(a => (
        <div key={a.id} style={s.card}>
          <div style={s.cardTop}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span style={s.autoName}>{a.name}</span>
              <StatusBadge status={a.is_active ? 'active' : 'paused'} />
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button style={{ ...s.tagBtn, background: a.is_active ? '#FF8B00' : '#00875A', color:'#fff' }}
                onClick={() => handleToggle(a.id, a.is_active)}>
                {a.is_active ? '⏸ Pause' : '▶ Activate'}
              </button>
              <button style={{ ...s.tagBtn, background:'#F4F5F7', color:'#42526E' }}
                onClick={() => navigate(`/logs/${a.id}`)}>📋 Logs</button>
              <button style={{ ...s.tagBtn, background:'#E6F4FF', color:'#0065FF' }}
                onClick={() => navigate(`/builder/${a.id}`)}>✏️ Edit</button>
              <button style={{ ...s.tagBtn, background:'#FFF0F0', color:'#DE350B' }}
                onClick={() => handleDelete(a.id, a.name)}>🗑 Delete</button>
            </div>
          </div>

          <div style={s.flow}>
            <span style={s.badge}>🎯 {a.trigger_type.replace(/_/g, ' ')}</span>
            <span style={{ fontSize:18, color:'#6C47FF', fontWeight:700 }}>→</span>
            <span style={s.badge}>⚡ {a.action_type.replace(/_/g, ' ')}</span>
          </div>

          <div style={s.stats}>
            <span>🔁 Runs: <strong>{a.run_count ?? 0}</strong></span>
            <span>🕐 Last: <strong>{a.last_triggered ? new Date(a.last_triggered).toLocaleString() : 'Never'}</strong></span>
            <span>📅 Created: <strong>{new Date(a.created_at).toLocaleDateString()}</strong></span>
          </div>
        </div>
      ))}
    </div>
  );
};

const s: Record<string, React.CSSProperties> = {
  container: { maxWidth:1000, margin:'0 auto', padding:'24px 16px' },
  topBar:    { display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 },
  title:     { margin:0, fontSize:24, fontWeight:700, color:'#172B4D' },
  subtitle:  { margin:'4px 0 0', fontSize:14, color:'#6B778C' },
  center:    { textAlign:'center', padding:60, fontSize:16, color:'#6B778C' },
  card:      { background:'#fff', borderRadius:12, padding:20, marginBottom:16, boxShadow:'0 1px 4px rgba(0,0,0,0.1)', border:'1px solid #EBECF0' },
  cardTop:   { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 },
  autoName:  { fontSize:17, fontWeight:600, color:'#172B4D' },
  flow:      { display:'flex', alignItems:'center', gap:10, marginBottom:12 },
  badge:     { background:'#F4F5F7', padding:'4px 12px', borderRadius:8, fontSize:13, color:'#42526E' },
  stats:     { display:'flex', gap:24, fontSize:13, color:'#6B778C' },
  btn:       { background:'linear-gradient(135deg,#6C47FF,#4A90E2)', color:'#fff', border:'none', borderRadius:8, padding:'10px 20px', cursor:'pointer', fontWeight:600, fontSize:14, textDecoration:'none', display:'inline-block' },
  tagBtn:    { border:'none', borderRadius:6, padding:'6px 12px', cursor:'pointer', fontWeight:600, fontSize:12 },
  empty:     { textAlign:'center', padding:'60px 20px', background:'#fff', borderRadius:12, border:'2px dashed #EBECF0' },
};

export default AutomationList;