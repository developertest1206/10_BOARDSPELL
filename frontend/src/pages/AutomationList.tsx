/**
 * Automation List Page
 * =====================
 * Shows all automations for the workspace in a card list.
 * Each card shows:
 *   - Automation name and status (active/paused)
 *   - Trigger type → Action type flow
 *   - Run count and last triggered time
 *   - Buttons: Pause, Logs, Edit, Delete
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAutomations, toggleAutomation, deleteAutomation } from '../api/client';
import { Automation } from '../types';
import StatusBadge from '../components/StatusBadge';

interface Props {
  workspaceId: string;
}

const AutomationList: React.FC<Props> = ({ workspaceId }) => {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const navigate = useNavigate();

  // Load automations from backend
  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getAutomations(workspaceId);
      setAutomations(data);
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || 'Failed to load automations');
    } finally {
      setLoading(false);
    }
  };

  // AFTER — moves load inside useEffect, no warning
  useEffect(() => {
      const fetchData = async () => {
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
      fetchData();
  }, [workspaceId]);

  // Toggle automation between active and paused
  const handleToggle = async (id: string, currentState: boolean) => {
    try {
      await toggleAutomation(id, !currentState);
      setAutomations(prev =>
        prev.map(a => a.id === id ? { ...a, is_active: !currentState } : a)
      );
    } catch {
      alert('Failed to toggle automation');
    }
  };

  // Delete automation with confirmation
  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await deleteAutomation(id);
      setAutomations(prev => prev.filter(a => a.id !== id));
    } catch {
      alert('Failed to delete automation');
    }
  };

  // ── Loading State ───────────────────────────────────────────────────────────
  if (loading) return (
    <div style={s.center}>⏳ Loading your automations...</div>
  );

  // ── Error State ─────────────────────────────────────────────────────────────
  if (error) return (
    <div style={s.center}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
      <h3 style={{ color: '#172B4D', margin: '0 0 8px' }}>Connection Error</h3>
      <p style={{ color: '#6B778C', margin: '0 0 24px' }}>{error}</p>
      <a href="http://localhost:3000/oauth/start"
        style={{ ...s.primaryBtn, textDecoration: 'none', display: 'inline-block' }}>
        🔗 Connect to monday.com
      </a>
    </div>
  );

  // ── Main Render ─────────────────────────────────────────────────────────────
  return (
    <div style={s.container}>

      {/* Top Bar */}
      <div style={s.topBar}>
        <div>
          <h1 style={s.title}>My Automations</h1>
          <p style={s.subtitle}>
            {automations.length} automation{automations.length !== 1 ? 's' : ''} configured
          </p>
        </div>
        <button style={s.primaryBtn} onClick={() => navigate('/builder')}>
          + New Automation
        </button>
      </div>

      {/* Empty State */}
      {automations.length === 0 && (
        <div style={s.emptyState}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>⚡</div>
          <h2 style={{ color: '#172B4D', margin: '0 0 8px' }}>No automations yet</h2>
          <p style={{ color: '#6B778C', margin: '0 0 24px' }}>
            Create your first cross-board automation to get started
          </p>
          <button style={s.primaryBtn} onClick={() => navigate('/builder')}>
            + Create First Automation
          </button>
        </div>
      )}

      {/* Automation Cards */}
      {automations.map(automation => (
        <div key={automation.id} style={s.card}>

          {/* Card Header: Name + Status + Action Buttons */}
          <div style={s.cardHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={s.autoName}>{automation.name}</span>
              <StatusBadge status={automation.is_active ? 'active' : 'paused'} />
            </div>

            <div style={s.btnGroup}>
              {/* Pause / Activate */}
              <button
                style={{
                  ...s.actionBtn,
                  background: automation.is_active ? '#FF8B00' : '#00875A',
                  color:      '#fff',
                }}
                onClick={() => handleToggle(automation.id, automation.is_active)}>
                {automation.is_active ? '⏸ Pause' : '▶ Activate'}
              </button>

              {/* View Logs */}
              <button
                style={{ ...s.actionBtn, background: '#F4F5F7', color: '#42526E' }}
                onClick={() => navigate(`/logs/${automation.id}`)}>
                📋 Logs
              </button>

              {/* Edit */}
              <button
                style={{ ...s.actionBtn, background: '#E6F4FF', color: '#0065FF' }}
                onClick={() => navigate(`/builder/${automation.id}`)}>
                ✏️ Edit
              </button>

              {/* Delete */}
              <button
                style={{ ...s.actionBtn, background: '#FFF0F0', color: '#DE350B' }}
                onClick={() => handleDelete(automation.id, automation.name)}>
                🗑 Delete
              </button>
            </div>
          </div>

          {/* Flow: Trigger → Action */}
          <div style={s.flow}>
            <span style={s.flowBadge}>
              🎯 {automation.trigger_type.replace(/_/g, ' ')}
            </span>
            <span style={{ fontSize: 18, color: '#6C47FF', fontWeight: 700 }}>→</span>
            <span style={s.flowBadge}>
              ⚡ {automation.action_type.replace(/_/g, ' ')}
            </span>
          </div>

          {/* Stats: Run Count + Last Triggered + Created Date */}
          <div style={s.stats}>
            <span>
              🔁 Runs: <strong>{automation.run_count ?? 0}</strong>
            </span>
            <span>
              🕐 Last triggered:{' '}
              <strong>
                {automation.last_triggered
                  ? new Date(automation.last_triggered).toLocaleString()
                  : 'Never'}
              </strong>
            </span>
            <span>
              📅 Created: <strong>{new Date(automation.created_at).toLocaleDateString()}</strong>
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  container:  { maxWidth: 1000, margin: '0 auto', padding: '28px 20px' },
  topBar:     { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 },
  title:      { margin: 0, fontSize: 26, fontWeight: 700, color: '#172B4D' },
  subtitle:   { margin: '4px 0 0', fontSize: 14, color: '#6B778C' },
  center:     { textAlign: 'center', padding: '80px 20px', color: '#6B778C', fontSize: 16 },
  emptyState: { textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: 16, border: '2px dashed #EBECF0' },
  card:       { background: '#fff', borderRadius: 14, padding: '20px 24px', marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid #EBECF0' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 },
  autoName:   { fontSize: 17, fontWeight: 600, color: '#172B4D' },
  btnGroup:   { display: 'flex', gap: 8, flexWrap: 'wrap' },
  actionBtn:  { border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontWeight: 600, fontSize: 12 },
  flow:       { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 },
  flowBadge:  { background: '#F4F5F7', padding: '4px 12px', borderRadius: 8, fontSize: 13, color: '#42526E' },
  stats:      { display: 'flex', gap: 28, fontSize: 13, color: '#6B778C', flexWrap: 'wrap' },
  primaryBtn: { background: 'linear-gradient(135deg, #6C47FF, #4A90E2)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 600, fontSize: 14 },
};

export default AutomationList;