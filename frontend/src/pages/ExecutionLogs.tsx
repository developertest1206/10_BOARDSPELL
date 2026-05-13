import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getLogs } from '../api/client';
import StatusBadge from '../components/StatusBadge';

const ExecutionLogs: React.FC = () => {
  const { automationId } = useParams<{ automationId: string }>();
  const [logs, setLogs]       = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!automationId) return;
    getLogs(automationId)
      .then(data => setLogs(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [automationId]);

  const formatAction = (action: any) => {
    if (!action) return null;
    if (typeof action === 'string') {
      try { action = JSON.parse(action); } catch { return action; }
    }
    if (action.user_ids) return `Sent notification to ${action.user_ids.length} user(s): "${action.message}"`;
    if (action.user_id)  return `Assigned person (user ${action.user_id}) to item ${action.target_item_id}`;
    if (action.value)    return `Changed column "${action.column_id}" to "${action.value}" on item ${action.target_item_id}`;
    return JSON.stringify(action);
  };

  const formatTrigger = (payload: any) => {
    if (!payload) return null;
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch { return payload; }
    }
    if (payload.type === 'date_reached') return `📅 Date trigger fired for item ${payload.item_id}`;
    const val = payload.value?.label?.text || payload.value?.text || '';
    return `🎯 ${payload.type?.replace(/_/g,' ')} — column: ${payload.columnId || ''} ${val ? `→ "${val}"` : ''}`;
  };

  if (loading) return (
    <div style={{ textAlign:'center', padding:60, color:'#6B778C' }}>⏳ Loading logs...</div>
  );

  return (
    <div style={{ maxWidth:860, margin:'0 auto', padding:'24px 16px' }}>

      <button
        style={{ background:'none', border:'none', color:'#6C47FF', cursor:'pointer', fontSize:14, fontWeight:600, padding:0, marginBottom:16 }}
        onClick={() => navigate('/')}>
        ← Back to Automations
      </button>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <h2 style={{ fontSize:24, fontWeight:700, color:'#172B4D', margin:'0 0 4px' }}>📋 Execution Logs</h2>
          <p style={{ color:'#6B778C', fontSize:14, margin:0 }}>Last {logs.length} runs for this automation</p>
        </div>
        <div style={{ display:'flex', gap:12, fontSize:13 }}>
          <span style={{ background:'#E6F9F0', color:'#00875A', padding:'4px 12px', borderRadius:12, fontWeight:600 }}>
            ✅ {logs.filter(l => l.status === 'success').length} success
          </span>
          <span style={{ background:'#FFF0F0', color:'#DE350B', padding:'4px 12px', borderRadius:12, fontWeight:600 }}>
            ❌ {logs.filter(l => l.status === 'failed').length} failed
          </span>
          <span style={{ background:'#F4F5F7', color:'#6B778C', padding:'4px 12px', borderRadius:12, fontWeight:600 }}>
            ⏭️ {logs.filter(l => l.status === 'skipped').length} skipped
          </span>
        </div>
      </div>

      {logs.length === 0 ? (
        <div style={{ textAlign:'center', padding:60, background:'#fff', borderRadius:12, border:'2px dashed #EBECF0' }}>
          <div style={{ fontSize:48, marginBottom:16 }}>📭</div>
          <h3 style={{ color:'#172B4D' }}>No runs yet</h3>
          <p style={{ color:'#6B778C' }}>Trigger the automation to see logs appear here.</p>
        </div>
      ) : (
        logs.map((log, i) => (
          <div key={log.id || i}
            style={{ background:'#fff', borderRadius:10, padding:18, marginBottom:12,
              boxShadow:'0 1px 4px rgba(0,0,0,0.08)', border:'1px solid #EBECF0' }}>

            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
              <StatusBadge status={log.status} />
              <span style={{ fontSize:13, color:'#6B778C' }}>
                🕐 {new Date(log.triggered_at).toLocaleString()}
              </span>
            </div>

            {formatTrigger(log.trigger_payload) && (
              <div style={{ fontSize:13, color:'#42526E', background:'#F8F9FA',
                padding:'8px 12px', borderRadius:6, marginBottom:8 }}>
                {formatTrigger(log.trigger_payload)}
              </div>
            )}

            {log.status === 'success' && formatAction(log.action_taken) && (
              <div style={{ fontSize:13, color:'#00875A', background:'#E6F9F0',
                padding:'8px 12px', borderRadius:6 }}>
                ⚡ {formatAction(log.action_taken)}
              </div>
            )}

            {log.status === 'skipped' && (
              <div style={{ fontSize:13, color:'#FF8B00', background:'#FFF8E1',
                padding:'8px 12px', borderRadius:6 }}>
                ⏭️ {log.error_message || 'Skipped'}
              </div>
            )}

            {log.status === 'failed' && (
              <div style={{ fontSize:13, color:'#DE350B', background:'#FFF0F0',
                padding:'8px 12px', borderRadius:6 }}>
                ❌ {log.error_message || 'Unknown error'}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
};

export default ExecutionLogs;