/**
 * Execution Logs Page
 * ====================
 * Shows the last 20 runs for a specific automation.
 * Each log entry shows:
 *   - Status badge (success / failed / skipped)
 *   - When it ran
 *   - What triggered it (human readable)
 *   - What action was taken (human readable)
 *   - Error message if it failed
 *
 * Also shows summary counts at the top.
 */

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

  /**
   * Convert the raw trigger payload into a human-readable string.
   * Instead of showing JSON, show something like:
   * "Status changed to Done on item 12345"
   */
  const formatTrigger = (payload: any): string => {
    if (!payload) return 'Unknown trigger';

    // Parse if string
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch { return payload; }
    }

    if (payload.type === 'date_reached') {
      return `📅 Date trigger — item ${payload.item_id} matched today (${payload.date || ''})`;
    }

    const eventType  = payload.type?.replace(/_/g, ' ') || 'event';
    const column     = payload.columnId || '';
    const valueText  = payload.value?.label?.text || payload.value?.text || '';
    const itemId     = payload.pulseId || payload.item_id || '';

    return `🎯 ${eventType}${column ? ` on column "${column}"` : ''}${valueText ? ` → "${valueText}"` : ''}${itemId ? ` (item ${itemId})` : ''}`;
  };

  /**
   * Convert the raw action_taken data into a human-readable string.
   */
  const formatAction = (action: any): string => {
    if (!action) return '';

    // Parse if string
    if (typeof action === 'string') {
      try { action = JSON.parse(action); } catch { return action; }
    }

    if (action.user_ids) {
      return `Sent notification to ${action.user_ids.length} user(s): "${action.message || ''}"`;
    }

    if (action.user_id) {
      return `Assigned user ${action.user_id} to item ${action.target_item_id || ''}`;
    }

    if (action.value !== undefined && action.column_id) {
      return `Changed column "${action.column_id}" to "${action.value}" on item ${action.target_item_id || ''}`;
    }

    return JSON.stringify(action);
  };

  // ── Counts ──────────────────────────────────────────────────────────────────
  const successCount = logs.filter(l => l.status === 'success').length;
  const failedCount  = logs.filter(l => l.status === 'failed').length;
  const skippedCount = logs.filter(l => l.status === 'skipped').length;

  // ── Loading State ────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ textAlign: 'center', padding: 80, color: '#6B778C' }}>
      ⏳ Loading execution logs...
    </div>
  );

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 20px' }}>

      {/* Back Button */}
      <button
        style={{
          background: 'none', border: 'none', color: '#6C47FF',
          cursor: 'pointer', fontSize: 14, fontWeight: 600, padding: 0, marginBottom: 20,
        }}
        onClick={() => navigate('/')}>
        ← Back to Automations
      </button>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: '#172B4D', margin: '0 0 4px' }}>
            📋 Execution Logs
          </h1>
          <p style={{ color: '#6B778C', fontSize: 14, margin: 0 }}>
            Last {logs.length} runs for this automation
          </p>
        </div>

        {/* Status Counts */}
        <div style={{ display: 'flex', gap: 10 }}>
          <span style={{ background: '#E6F9F0', color: '#00875A', padding: '5px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>
            ✅ {successCount} success
          </span>
          <span style={{ background: '#FFF0F0', color: '#DE350B', padding: '5px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>
            ❌ {failedCount} failed
          </span>
          <span style={{ background: '#F4F5F7', color: '#6B778C', padding: '5px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>
            ⏭️ {skippedCount} skipped
          </span>
        </div>
      </div>

      {/* Empty State */}
      {logs.length === 0 && (
        <div style={{
          textAlign: 'center', padding: 60, background: '#fff',
          borderRadius: 14, border: '2px dashed #EBECF0',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
          <h2 style={{ color: '#172B4D', margin: '0 0 8px' }}>No runs yet</h2>
          <p style={{ color: '#6B778C', margin: 0 }}>
            Trigger the automation by changing a status in monday.com
          </p>
        </div>
      )}

      {/* Log Entries */}
      {logs.map((log, i) => (
        <div key={log.id || i} style={{
          background:   '#fff',
          borderRadius: 12,
          padding:      20,
          marginBottom: 12,
          boxShadow:    '0 1px 4px rgba(0,0,0,0.08)',
          border:       '1px solid #EBECF0',
        }}>
          {/* Status + Timestamp */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <StatusBadge status={log.status} />
            <span style={{ fontSize: 13, color: '#6B778C' }}>
              🕐 {new Date(log.triggered_at).toLocaleString()}
            </span>
          </div>

          {/* Trigger Info */}
          {log.trigger_payload && (
            <div style={{
              fontSize:    13,
              color:       '#42526E',
              background:  '#F8F9FA',
              padding:     '8px 12px',
              borderRadius: 6,
              marginBottom: 8,
            }}>
              {formatTrigger(log.trigger_payload)}
            </div>
          )}

          {/* Success: Show what action was taken */}
          {log.status === 'success' && log.action_taken && (
            <div style={{
              fontSize:    13,
              color:       '#00875A',
              background:  '#E6F9F0',
              padding:     '8px 12px',
              borderRadius: 6,
            }}>
              ⚡ {formatAction(log.action_taken)}
            </div>
          )}

          {/* Skipped: Show reason */}
          {log.status === 'skipped' && (
            <div style={{
              fontSize:    13,
              color:       '#FF8B00',
              background:  '#FFF8E1',
              padding:     '8px 12px',
              borderRadius: 6,
            }}>
              ⏭️ {log.error_message || 'Condition not met or trigger did not match'}
            </div>
          )}

          {/* Failed: Show error */}
          {log.status === 'failed' && (
            <div style={{
              fontSize:    13,
              color:       '#DE350B',
              background:  '#FFF0F0',
              padding:     '8px 12px',
              borderRadius: 6,
            }}>
              ❌ Error: {log.error_message || 'Unknown error occurred'}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default ExecutionLogs;