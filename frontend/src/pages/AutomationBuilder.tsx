/**
 * Automation Builder Page
 * ========================
 * A 4-step wizard for creating or editing automations.
 *
 * Step 1 — Trigger:   Select board + trigger type + configure trigger
 * Step 2 — Condition: Optional "only if" condition
 * Step 3 — Action:    Select action type + configure action
 * Step 4 — Save:      Name the automation + review summary + save
 *
 * All dropdowns are populated with REAL data from monday.com API.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  createAutomation,
  updateAutomationFull,
  getBoards,
  getBoardColumns,
  getBoardGroups,
  getUsers,
  getAutomations,
  getBoardItems,
  getStatusLabels,
} from '../api/client';
import { Board, BoardColumn, BoardGroup, User, StatusLabel } from '../types';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

interface Props { workspaceId: string; }

// ── Constants ─────────────────────────────────────────────────────────────────

const TRIGGER_TYPES = [
  {
    value:       'status_change',
    label:       '🔄 Status column changes to a value',
    description: 'Fires when a status column on Board A changes to a specific value',
  },
  {
    value:       'item_moved',
    label:       '📦 Item moved to a group',
    description: 'Fires when an item is moved to a specific group on Board A',
  },
  {
    value:       'date_reached',
    label:       '📅 Date column is reached (today)',
    description: 'Fires at midnight when an item\'s date column matches today\'s date',
  },
];

const ACTION_TYPES = [
  {
    value:       'change_column',
    label:       '✏️ Change a column value',
    description: 'Update any column on a target item in Board B',
  },
  {
    value:       'assign_person',
    label:       '👤 Assign a person',
    description: 'Assign a team member to an item in Board B',
  },
  {
    value:       'send_notification',
    label:       '🔔 Send a notification',
    description: 'Send an in-app monday.com notification to selected users',
  },
];

const STEPS = ['Trigger', 'Condition', 'Action', 'Save'];

// ── Component ─────────────────────────────────────────────────────────────────

const AutomationBuilder: React.FC<Props> = ({ workspaceId }) => {
  const navigate          = useNavigate();
  const { id }            = useParams<{ id: string }>();
  const isEdit            = !!id;

  // Step management
  const [step, setStep]       = useState(0);
  const [saving, setSaving]   = useState(false);
  const [loading, setLoading] = useState(isEdit); // Loading only when editing

  // Data from monday.com API
  const [boards, setBoards]               = useState<Board[]>([]);
  const [triggerColumns, setTriggerCols]  = useState<BoardColumn[]>([]);
  const [triggerGroups, setTriggerGroups] = useState<BoardGroup[]>([]);
  const [actionColumns, setActionCols]    = useState<BoardColumn[]>([]);
  const [actionItems, setActionItems]     = useState<any[]>([]);
  const [users, setUsers]                 = useState<User[]>([]);
  const [statusLabels, setStatusLabels]   = useState<StatusLabel[]>([]);
  const [loadingLabels, setLoadingLabels] = useState(false);

  // Form state — all fields for the automation
  const [form, setForm] = useState({
    name:             '',
    trigger_type:     '',
    trigger_board_id: '',
    trigger_config:   {} as Record<string, any>,
    use_condition:    false,
    condition_config: {} as Record<string, any>,
    action_type:      '',
    action_board_id:  '',
    action_config:    {} as Record<string, any>,
  });

  // Helper to update one field in the form
  const set = (key: string, value: any) =>
    setForm(prev => ({ ...prev, [key]: value }));

  // ── Load initial data ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!workspaceId) return;
    getBoards(workspaceId).then(setBoards).catch(console.error);
    getUsers(workspaceId).then(setUsers).catch(console.error);
  }, [workspaceId]);

  // ── Load existing automation for editing ──────────────────────────────────
  useEffect(() => {
    if (!isEdit || !id || !workspaceId) return;

    getAutomations(workspaceId).then((list: any[]) => {
      const auto = list.find((a: any) => a.id === id);
      if (!auto) return;

      // Parse JSON config fields
      const tc = typeof auto.trigger_config   === 'string' ? JSON.parse(auto.trigger_config)   : (auto.trigger_config   || {});
      const cc = typeof auto.condition_config === 'string' ? JSON.parse(auto.condition_config) : (auto.condition_config || {});
      const ac = typeof auto.action_config    === 'string' ? JSON.parse(auto.action_config)    : (auto.action_config    || {});

      setForm({
        name:             auto.name             || '',
        trigger_type:     auto.trigger_type     || '',
        trigger_board_id: auto.trigger_board_id || '',
        trigger_config:   tc,
        use_condition:    !!auto.condition_config,
        condition_config: cc,
        action_type:      auto.action_type     || '',
        action_board_id:  auto.action_board_id || '',
        action_config:    ac,
      });
    }).finally(() => setLoading(false));
  }, [id, isEdit, workspaceId]);

  // ── Load trigger board columns + groups when trigger board changes ─────────
  useEffect(() => {
    if (!form.trigger_board_id || !workspaceId) return;
    setTriggerCols([]); setTriggerGroups([]);
    getBoardColumns(workspaceId, form.trigger_board_id).then(setTriggerCols).catch(console.error);
    getBoardGroups(workspaceId,  form.trigger_board_id).then(setTriggerGroups).catch(console.error);
  }, [form.trigger_board_id, workspaceId]);

  // ── Load status labels when a status column is selected ───────────────────
  useEffect(() => {
    const colId = form.trigger_config?.column_id;
    if (!colId || !form.trigger_board_id || !workspaceId) return;

    // Only fetch labels for status columns
    const col = triggerColumns.find(c => c.id === colId);
    if (!col || col.type !== 'status') return;

    setLoadingLabels(true);
    getStatusLabels(workspaceId, form.trigger_board_id, colId)
      .then(setStatusLabels)
      .catch(console.error)
      .finally(() => setLoadingLabels(false));
  }, [form.trigger_config?.column_id, form.trigger_board_id, workspaceId, triggerColumns]);

  // ── Load action board columns + items when action board changes ───────────
  useEffect(() => {
    if (!form.action_board_id || !workspaceId) return;
    setActionCols([]); setActionItems([]);
    getBoardColumns(workspaceId, form.action_board_id).then(setActionCols).catch(console.error);
    getBoardItems(workspaceId,   form.action_board_id).then(setActionItems).catch(console.error);
  }, [form.action_board_id, workspaceId]);

  // ── Validation: can the user proceed to next step? ────────────────────────
  const canNext = () => {
    if (step === 0) return !!form.trigger_type && !!form.trigger_board_id;
    if (step === 1) return true; // Condition is optional
    if (step === 2) return !!form.action_type;
    if (step === 3) return form.name.trim().length > 0;
    return false;
  };

  // ── Save automation ───────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        workspace_id:     workspaceId,
        name:             form.name,
        trigger_type:     form.trigger_type,
        trigger_board_id: form.trigger_board_id,
        trigger_config:   form.trigger_config,
        condition_config: form.use_condition ? form.condition_config : null,
        action_type:      form.action_type,
        action_board_id:  form.action_board_id || null,
        action_config:    form.action_config,
      };

      if (isEdit && id) {
        await updateAutomationFull(id, payload);  // Update existing
      } else {
        await createAutomation(payload);           // Create new
      }

      navigate('/');  // Go back to list
    } catch (e: any) {
      alert(`Failed to save: ${e.response?.data?.detail || e.message}`);
    } finally {
      setSaving(false);
    }
  };

  // ── Loading state (when editing) ──────────────────────────────────────────
  if (loading) return (
    <div style={{ textAlign: 'center', padding: 80, color: '#6B778C' }}>
      ⏳ Loading automation...
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={s.container}>

      {/* ── Progress Steps Indicator ── */}
      <div style={s.steps}>
        {STEPS.map((stepName, i) => (
          <div key={stepName} style={s.stepItem}>
            <div style={{
              ...s.stepCircle,
              background: i <= step
                ? 'linear-gradient(135deg, #6C47FF, #4A90E2)'
                : '#EBECF0',
              color: i <= step ? '#fff' : '#97A0AF',
            }}>
              {i < step ? '✓' : i + 1}
            </div>
            <span style={{
              fontSize:   12,
              fontWeight: 600,
              color:      i <= step ? '#6C47FF' : '#97A0AF',
            }}>
              {stepName}
            </span>
          </div>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          STEP 0 — TRIGGER
          Select which board to watch and what event should trigger this automation
      ════════════════════════════════════════════════════════════════════ */}
      {step === 0 && (
        <div style={s.card}>
          <h2 style={s.cardTitle}>🎯 Step 1 — Set Your Trigger</h2>
          <p style={s.cardSub}>
            What event on Board A should start this automation?
          </p>

          {/* Trigger Board Dropdown */}
          <label style={s.label}>Trigger Board (Board A)</label>
          <select style={s.select}
            value={form.trigger_board_id}
            onChange={e => {
              set('trigger_board_id', e.target.value);
              set('trigger_config', {});  // Reset config when board changes
            }}>
            <option value="">— Select the board to watch —</option>
            {boards.map(b => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.items_count} items)
              </option>
            ))}
          </select>

          {/* Trigger Type Options */}
          <label style={s.label}>Trigger Type</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
            {TRIGGER_TYPES.map(t => (
              <div key={t.value}
                style={{
                  ...s.optionCard,
                  border:     form.trigger_type === t.value ? '2px solid #6C47FF' : '2px solid #EBECF0',
                  background: form.trigger_type === t.value ? '#F3F0FF' : '#fff',
                }}
                onClick={() => {
                  set('trigger_type', t.value);
                  set('trigger_config', {});  // Reset when type changes
                }}>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>{t.label}</div>
                <div style={{ fontSize: 12, color: '#6B778C' }}>{t.description}</div>
              </div>
            ))}
          </div>

          {/* ── Status Change Config ── */}
          {form.trigger_type === 'status_change' && (
            <>
              {/* Select which status column to watch */}
              <label style={s.label}>Which Status Column to Watch?</label>
              <select style={s.select}
                value={form.trigger_config?.column_id || ''}
                onChange={e => set('trigger_config', {
                  ...form.trigger_config,
                  column_id: e.target.value,
                  value:     '',  // Reset value when column changes
                })}>
                <option value="">— Select a status column —</option>
                {triggerColumns
                  .filter(c => c.type === 'status')
                  .map(c => <option key={c.id} value={c.id}>{c.title}</option>)
                }
              </select>

              {/* Select which status value should trigger */}
              {form.trigger_config?.column_id && (
                <>
                  <label style={s.label}>When Status Changes To</label>
                  {loadingLabels ? (
                    <p style={{ fontSize: 13, color: '#6B778C' }}>⏳ Loading status options...</p>
                  ) : statusLabels.length > 0 ? (
                    // Show real status values as dropdown
                    <select style={s.select}
                      value={form.trigger_config?.value || ''}
                      onChange={e => set('trigger_config', {
                        ...form.trigger_config,
                        value: e.target.value,
                      })}>
                      <option value="">— Select a status value —</option>
                      {statusLabels.map((l: StatusLabel) => (
                        <option key={l.index} value={l.label}>{l.label}</option>
                      ))}
                    </select>
                  ) : (
                    // Fallback: text input if labels can't be loaded
                    <input style={s.input}
                      placeholder="e.g. Done, Working on it, Stuck"
                      value={form.trigger_config?.value || ''}
                      onChange={e => set('trigger_config', {
                        ...form.trigger_config,
                        value: e.target.value,
                      })} />
                  )}
                </>
              )}
            </>
          )}

          {/* ── Item Moved Config ── */}
          {form.trigger_type === 'item_moved' && (
            <>
              <label style={s.label}>Which Group (destination)?</label>
              {!form.trigger_board_id ? (
                <p style={{ color: '#DE350B', fontSize: 13 }}>⚠️ Select a Trigger Board first</p>
              ) : triggerGroups.length === 0 ? (
                <p style={{ color: '#6B778C', fontSize: 13 }}>⏳ Loading groups...</p>
              ) : (
                <select style={s.select}
                  value={form.trigger_config?.group_id || ''}
                  onChange={e => set('trigger_config', { group_id: e.target.value })}>
                  <option value="">— Select destination group —</option>
                  {triggerGroups.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
                </select>
              )}

              {/* Manual setup instructions */}
              <div style={s.warningBox}>
                <p style={{ margin: '0 0 6px', fontSize: 13, color: '#FF8B00', fontWeight: 600 }}>
                  ⚠️ One-Time Manual Setup Required
                </p>
                <p style={{ margin: 0, fontSize: 12, color: '#6B778C', lineHeight: 1.6 }}>
                  monday.com's API doesn't support auto-registering group move webhooks.<br/>
                  Please do this once:<br/>
                  <strong>monday.com → Your Board → Automate → Search "webhook"</strong><br/>
                  Select "When item moves to group → Send webhook to:"<br/>
                  <code style={{ background: '#F4F5F7', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>
                    {API_URL}/webhooks/receive
                  </code>
                </p>
              </div>
            </>
          )}

          {/* ── Date Reached Config ── */}
          {form.trigger_type === 'date_reached' && (
            <>
              <label style={s.label}>Which Date Column to Check?</label>
              <select style={s.select}
                value={form.trigger_config?.column_id || ''}
                onChange={e => set('trigger_config', { column_id: e.target.value })}>
                <option value="">— Select a date column —</option>
                {triggerColumns
                  .filter(c => c.type === 'date')
                  .map(c => <option key={c.id} value={c.id}>{c.title}</option>)
                }
              </select>

              <div style={s.infoBox}>
                <p style={{ margin: 0, fontSize: 13, color: '#0065FF', fontWeight: 600 }}>
                  ℹ️ How Date Trigger Works
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#42526E', lineHeight: 1.6 }}>
                  This automation fires automatically at midnight every day.<br/>
                  When any item's date column matches today's date, the action executes.<br/>
                  It will not fire twice for the same item on the same day.
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          STEP 1 — CONDITION (OPTIONAL)
          Add a "only if" filter to prevent the automation firing every time
      ════════════════════════════════════════════════════════════════════ */}
      {step === 1 && (
        <div style={s.card}>
          <h2 style={s.cardTitle}>🔍 Step 2 — Add Condition (Optional)</h2>
          <p style={s.cardSub}>
            Only run this automation if an additional condition is met on the triggering item.
          </p>

          {/* Checkbox to enable condition */}
          <label style={{
            display:     'flex',
            alignItems:  'center',
            gap:         10,
            fontSize:    14,
            cursor:      'pointer',
            marginTop:   8,
            fontWeight:  500,
            color:       '#172B4D',
          }}>
            <input
              type="checkbox"
              checked={form.use_condition}
              onChange={e => set('use_condition', e.target.checked)}
              style={{ width: 18, height: 18, cursor: 'pointer' }}
            />
            Only fire if a column equals a specific value
          </label>

          {/* Condition configuration — shown when checkbox is checked */}
          {form.use_condition && (
            <div style={{ marginTop: 16, padding: 16, background: '#F8F9FA', borderRadius: 8 }}>

              <label style={s.label}>Column to Check</label>
              <select style={s.select}
                value={form.condition_config?.column_id || ''}
                onChange={e => set('condition_config', {
                  ...form.condition_config,
                  column_id: e.target.value,
                })}>
                <option value="">— Select a column —</option>
                {triggerColumns.map(c => (
                  <option key={c.id} value={c.id}>{c.title} ({c.type})</option>
                ))}
              </select>

              <label style={s.label}>Must Equal</label>
              <input style={s.input}
                placeholder="e.g. High, Urgent, Done"
                value={form.condition_config?.value || ''}
                onChange={e => set('condition_config', {
                  ...form.condition_config,
                  value: e.target.value,
                })} />

              {/* Preview what the condition will check */}
              {form.condition_config?.column_id && form.condition_config?.value && (
                <div style={{ ...s.infoBox, marginTop: 12 }}>
                  <p style={{ margin: 0, fontSize: 13, color: '#00875A' }}>
                    ✅ Will only fire when:{' '}
                    <strong>
                      {triggerColumns.find(c => c.id === form.condition_config?.column_id)?.title}
                    </strong>
                    {' '} = {' '}
                    <strong>"{form.condition_config.value}"</strong>
                  </p>
                </div>
              )}
            </div>
          )}

          {!form.use_condition && (
            <div style={{ marginTop: 16, padding: 14, background: '#F4F5F7', borderRadius: 8 }}>
              <p style={{ margin: 0, fontSize: 13, color: '#6B778C' }}>
                ⚡ No condition set — automation will fire for ALL matching events
              </p>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          STEP 2 — ACTION
          Choose what happens on Board B when the trigger fires
      ════════════════════════════════════════════════════════════════════ */}
      {step === 2 && (
        <div style={s.card}>
          <h2 style={s.cardTitle}>⚡ Step 3 — Set Your Action</h2>
          <p style={s.cardSub}>
            What should happen automatically on Board B when the trigger fires?
          </p>

          {/* Action Type Selection */}
          <label style={s.label}>Action Type</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
            {ACTION_TYPES.map(a => (
              <div key={a.value}
                style={{
                  ...s.optionCard,
                  border:     form.action_type === a.value ? '2px solid #6C47FF' : '2px solid #EBECF0',
                  background: form.action_type === a.value ? '#F3F0FF' : '#fff',
                }}
                onClick={() => {
                  set('action_type', a.value);
                  set('action_config', {});  // Reset config when type changes
                }}>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>{a.label}</div>
                <div style={{ fontSize: 12, color: '#6B778C' }}>{a.description}</div>
              </div>
            ))}
          </div>

          {/* ── A1 + A2: Target Board + Item + Column ── */}
          {(form.action_type === 'change_column' || form.action_type === 'assign_person') && (
            <>
              <label style={s.label}>Target Board (Board B)</label>
              <select style={s.select}
                value={form.action_board_id}
                onChange={e => {
                  set('action_board_id', e.target.value);
                  set('action_config', {});
                }}>
                <option value="">— Select the target board —</option>
                {boards.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>

              {form.action_board_id && (
                <>
                  <label style={s.label}>Target Item</label>
                  {actionItems.length === 0
                    ? <p style={{ fontSize: 13, color: '#6B778C' }}>⏳ Loading items...</p>
                    : (
                      <select style={s.select}
                        value={form.action_config?.target_item_id || ''}
                        onChange={e => set('action_config', {
                          ...form.action_config,
                          target_item_id: e.target.value,
                        })}>
                        <option value="">— Select which item to update —</option>
                        {actionItems.map((item: any) => (
                          <option key={item.id} value={item.id}>
                            {item.name} — {item.group?.title}
                          </option>
                        ))}
                      </select>
                    )
                  }

                  <label style={s.label}>Target Column</label>
                  <select style={s.select}
                    value={form.action_config?.column_id || ''}
                    onChange={e => set('action_config', {
                      ...form.action_config,
                      column_id: e.target.value,
                    })}>
                    <option value="">— Select which column to change —</option>
                    {actionColumns.map(c => (
                      <option key={c.id} value={c.id}>{c.title} ({c.type})</option>
                    ))}
                  </select>
                </>
              )}
            </>
          )}

          {/* ── A1 Extra: New Value ── */}
          {form.action_type === 'change_column' && form.action_config?.column_id && (
            <>
              <label style={s.label}>New Value to Set</label>
              <input style={s.input}
                placeholder="e.g. Done, Ready, In Progress"
                value={form.action_config?.value || ''}
                onChange={e => set('action_config', {
                  ...form.action_config,
                  value: e.target.value,
                })} />
              <p style={{ fontSize: 12, color: '#6B778C', marginTop: 4 }}>
                For status columns, type the exact label name (case-insensitive)
              </p>
            </>
          )}

          {/* ── A2 Extra: Select User to Assign ── */}
          {form.action_type === 'assign_person' && (
            <>
              <label style={s.label}>Assign To (User)</label>
              <select style={s.select}
                value={form.action_config?.user_id || ''}
                onChange={e => set('action_config', {
                  ...form.action_config,
                  user_id: e.target.value,
                })}>
                <option value="">— Select a team member —</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                ))}
              </select>
            </>
          )}

          {/* ── A3: Notification — User Checkboxes + Message ── */}
          {form.action_type === 'send_notification' && (
            <>
              <label style={s.label}>Who to Notify?</label>
              <div style={{
                border:    '1px solid #DFE1E6',
                borderRadius: 8,
                padding:   12,
                maxHeight: 240,
                overflowY: 'auto',
              }}>
                {users.map(u => {
                  const isSelected = (form.action_config?.user_ids || []).includes(u.id);
                  return (
                    <label key={u.id} style={{
                      display:       'flex',
                      alignItems:    'center',
                      gap:           10,
                      padding:       '8px 4px',
                      cursor:        'pointer',
                      borderBottom:  '1px solid #F4F5F7',
                    }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={e => {
                          const current: string[] = form.action_config?.user_ids || [];
                          const updated = e.target.checked
                            ? [...current, u.id]
                            : current.filter((x: string) => x !== u.id);
                          set('action_config', { ...form.action_config, user_ids: updated });
                        }}
                        style={{ width: 16, height: 16, cursor: 'pointer' }}
                      />
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#172B4D' }}>
                          {u.name}
                        </div>
                        <div style={{ fontSize: 12, color: '#6B778C' }}>{u.email}</div>
                      </div>
                      {isSelected && (
                        <span style={{ marginLeft: 'auto', color: '#00875A', fontSize: 12, fontWeight: 600 }}>
                          ✅
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>

              {/* Show count of selected users */}
              {(form.action_config?.user_ids || []).length > 0 && (
                <div style={{ background: '#E6F9F0', borderRadius: 6, padding: '8px 12px', marginTop: 8, fontSize: 13, color: '#00875A' }}>
                  ✅ {(form.action_config?.user_ids || []).length} user(s) selected
                </div>
              )}

              <label style={s.label}>Notification Message</label>
              <input style={s.input}
                placeholder="e.g. Engineering task is Done! Please proceed."
                value={form.action_config?.message || ''}
                onChange={e => set('action_config', {
                  ...form.action_config,
                  message: e.target.value,
                })} />
            </>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          STEP 3 — NAME & SAVE
          Give the automation a name and review the summary before saving
      ════════════════════════════════════════════════════════════════════ */}
      {step === 3 && (
        <div style={s.card}>
          <h2 style={s.cardTitle}>💾 Step 4 — Name & Save</h2>
          <p style={s.cardSub}>Give your automation a clear, descriptive name.</p>

          <label style={s.label}>Automation Name</label>
          <input style={s.input}
            placeholder="e.g. Engineering Done → Marketing Ready"
            value={form.name}
            onChange={e => set('name', e.target.value)} />

          {/* Summary of the full automation */}
          <div style={{ background: '#F8F9FA', borderRadius: 10, padding: 20, marginTop: 20 }}>
            <h3 style={{ margin: '0 0 16px', color: '#172B4D', fontSize: 16 }}>
              📋 Automation Summary
            </h3>

            <SummaryRow label="🎯 Trigger">
              <strong>{form.trigger_type.replace(/_/g, ' ')}</strong>
              {' on '}
              <strong>{boards.find(b => b.id === form.trigger_board_id)?.name || 'Board'}</strong>
            </SummaryRow>

            {form.trigger_type === 'status_change' && (
              <SummaryRow label="📌 When">
                Column <strong>{triggerColumns.find(c => c.id === form.trigger_config?.column_id)?.title}</strong>
                {' changes to "'}
                <strong>{form.trigger_config?.value}</strong>
                {'"'}
              </SummaryRow>
            )}

            {form.trigger_type === 'item_moved' && (
              <SummaryRow label="📦 Group">
                Item moves to{' '}
                <strong>{triggerGroups.find(g => g.id === form.trigger_config?.group_id)?.title}</strong>
              </SummaryRow>
            )}

            {form.trigger_type === 'date_reached' && (
              <SummaryRow label="📅 Column">
                Date column{' '}
                <strong>{triggerColumns.find(c => c.id === form.trigger_config?.column_id)?.title}</strong>
                {' reaches today'}
              </SummaryRow>
            )}

            {form.use_condition && (
              <SummaryRow label="🔍 Condition">
                Only if <strong>{triggerColumns.find(c => c.id === form.condition_config?.column_id)?.title}</strong>
                {' = "'}
                <strong>{form.condition_config?.value}</strong>
                {'"'}
              </SummaryRow>
            )}

            <SummaryRow label="⚡ Action">
              <strong>{form.action_type.replace(/_/g, ' ')}</strong>
              {form.action_board_id && (
                <> on <strong>{boards.find(b => b.id === form.action_board_id)?.name}</strong></>
              )}
            </SummaryRow>

            {form.action_type === 'change_column' && (
              <SummaryRow label="✏️ Set">
                Column <strong>{actionColumns.find(c => c.id === form.action_config?.column_id)?.title}</strong>
                {' to "'}
                <strong>{form.action_config?.value}</strong>
                {'"'}
              </SummaryRow>
            )}

            {form.action_type === 'assign_person' && (
              <SummaryRow label="👤 Assign">
                <strong>{users.find(u => u.id === form.action_config?.user_id)?.name}</strong>
              </SummaryRow>
            )}

            {form.action_type === 'send_notification' && (
              <>
                <SummaryRow label="👥 Notify">
                  {(form.action_config?.user_ids || [])
                    .map((uid: string) => users.find(u => u.id === uid)?.name || uid)
                    .join(', ') || 'No users selected'}
                </SummaryRow>
                <SummaryRow label="💬 Message">
                  "{form.action_config?.message}"
                </SummaryRow>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Navigation Buttons ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>

        {/* Back button (hidden on first step) */}
        {step > 0 && (
          <button style={s.backBtn} onClick={() => setStep(st => st - 1)}>
            ← Back
          </button>
        )}

        {/* Next / Save button */}
        <button
          style={{
            ...s.primaryBtn,
            marginLeft: step === 0 ? 'auto' : 0,
            opacity:    canNext() ? 1 : 0.4,
            cursor:     canNext() ? 'pointer' : 'not-allowed',
          }}
          disabled={!canNext() || saving}
          onClick={step < 3 ? () => setStep(st => st + 1) : handleSave}>
          {step < 3
            ? 'Next →'
            : saving
              ? '⏳ Saving...'
              : isEdit
                ? '✅ Update Automation'
                : '✅ Save Automation'
          }
        </button>
      </div>
    </div>
  );
};


// ── Helper Component: Summary Row ─────────────────────────────────────────────
const SummaryRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ display: 'flex', gap: 12, marginBottom: 10, fontSize: 14, alignItems: 'flex-start' }}>
    <span style={{ fontWeight: 600, color: '#6C47FF', minWidth: 120, flexShrink: 0 }}>{label}</span>
    <span style={{ color: '#172B4D', lineHeight: 1.5 }}>{children}</span>
  </div>
);


// ── Styles ────────────────────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  container:  { maxWidth: 740, margin: '0 auto', padding: '24px 20px' },
  steps:      { display: 'flex', justifyContent: 'center', gap: 48, marginBottom: 32 },
  stepItem:   { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 },
  stepCircle: { width: 38, height: 38, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15 },
  card:       { background: '#fff', borderRadius: 14, padding: 28, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #EBECF0', marginBottom: 20 },
  cardTitle:  { margin: '0 0 6px', fontSize: 20, fontWeight: 700, color: '#172B4D' },
  cardSub:    { margin: '0 0 24px', fontSize: 14, color: '#6B778C', lineHeight: 1.5 },
  label:      { display: 'block', fontSize: 13, fontWeight: 600, color: '#42526E', marginBottom: 6, marginTop: 18 },
  input:      { width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #DFE1E6', fontSize: 14, outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s' },
  select:     { width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #DFE1E6', fontSize: 14, outline: 'none', background: '#fff', boxSizing: 'border-box', cursor: 'pointer' },
  optionCard: { padding: '14px 16px', borderRadius: 10, cursor: 'pointer', fontSize: 14, transition: 'all 0.15s' },
  primaryBtn: { background: 'linear-gradient(135deg, #6C47FF, #4A90E2)', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 28px', cursor: 'pointer', fontWeight: 600, fontSize: 14 },
  backBtn:    { background: 'none', border: '1px solid #DFE1E6', borderRadius: 8, padding: '11px 20px', cursor: 'pointer', fontSize: 14, color: '#42526E' },
  warningBox: { background: '#FFF8E1', border: '1px solid #FFD700', borderRadius: 8, padding: 14, marginTop: 14 },
  infoBox:    { background: '#E6F4FF', border: '1px solid #4A90E2', borderRadius: 8, padding: 12, marginTop: 12 },
};

export default AutomationBuilder;