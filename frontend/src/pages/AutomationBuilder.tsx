import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import {
  createAutomation, updateAutomationFull,
  getBoards, getBoardColumns, getBoardGroups,
  getUsers, getAutomations, getBoardItems,
} from '../api/client';
import { Board, BoardColumn, BoardGroup, User } from '../types';

interface Props { workspaceId: string; }

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

const TRIGGER_TYPES = [
  { value:'status_change', label:'🔄 Status column changes to a value' },
  { value:'item_moved',    label:'📦 Item moved to a group'            },
  { value:'date_reached',  label:'📅 Date column is reached (today)'   },
];

const ACTION_TYPES = [
  { value:'change_column',     label:'✏️ Change a column value' },
  { value:'assign_person',     label:'👤 Assign a person'       },
  { value:'send_notification', label:'🔔 Send a notification'   },
];

const STEPS = ['Trigger', 'Condition', 'Action', 'Save'];

const AutomationBuilder: React.FC<Props> = ({ workspaceId }) => {
  const navigate          = useNavigate();
  const { id }            = useParams<{ id: string }>();
  const isEdit            = !!id;
  const [step, setStep]   = useState(0);
  const [saving, setSaving]   = useState(false);
  const [loading, setLoading] = useState(isEdit);

  const [boards, setBoards]                   = useState<Board[]>([]);
  const [triggerColumns, setTriggerColumns]   = useState<BoardColumn[]>([]);
  const [triggerGroups, setTriggerGroups]     = useState<BoardGroup[]>([]);
  const [actionColumns, setActionColumns]     = useState<BoardColumn[]>([]);
  const [actionItems, setActionItems]         = useState<any[]>([]);
  const [users, setUsers]                     = useState<User[]>([]);
  const [statusLabels, setStatusLabels]       = useState<any[]>([]);
  const [loadingLabels, setLoadingLabels]     = useState(false);

  const [form, setForm] = useState({
    name:'', trigger_type:'', trigger_board_id:'',
    trigger_config: {} as Record<string, any>,
    use_condition: false,
    condition_config: {} as Record<string, any>,
    action_type:'', action_board_id:'',
    action_config: {} as Record<string, any>,
  });

  const set = (key: string, value: any) =>
    setForm(prev => ({ ...prev, [key]: value }));

  // Load boards + users
  useEffect(() => {
    if (!workspaceId) return;
    getBoards(workspaceId).then(setBoards).catch(console.error);
    getUsers(workspaceId).then(setUsers).catch(console.error);
  }, [workspaceId]);

  // Load existing automation for edit
  useEffect(() => {
    if (!isEdit || !id || !workspaceId) return;
    getAutomations(workspaceId).then((list: any[]) => {
      const auto = list.find((a: any) => a.id === id);
      if (!auto) return;
      const tc = typeof auto.trigger_config   === 'string' ? JSON.parse(auto.trigger_config)   : (auto.trigger_config   || {});
      const cc = typeof auto.condition_config === 'string' ? JSON.parse(auto.condition_config) : (auto.condition_config || {});
      const ac = typeof auto.action_config    === 'string' ? JSON.parse(auto.action_config)    : (auto.action_config    || {});
      setForm({
        name: auto.name || '', trigger_type: auto.trigger_type || '',
        trigger_board_id: auto.trigger_board_id || '', trigger_config: tc,
        use_condition: !!auto.condition_config, condition_config: cc,
        action_type: auto.action_type || '', action_board_id: auto.action_board_id || '',
        action_config: ac,
      });
    }).finally(() => setLoading(false));
  }, [id, isEdit, workspaceId]);

  // Load trigger board columns + groups
  useEffect(() => {
    if (!form.trigger_board_id || !workspaceId) return;
    setTriggerColumns([]); setTriggerGroups([]); setStatusLabels([]);
    getBoardColumns(workspaceId, form.trigger_board_id).then(setTriggerColumns).catch(console.error);
    getBoardGroups(workspaceId, form.trigger_board_id).then(setTriggerGroups).catch(console.error);
  }, [form.trigger_board_id, workspaceId]);

  // Load status labels when column selected
  useEffect(() => {
    const colId = form.trigger_config?.column_id;
    if (!colId || !form.trigger_board_id || !workspaceId) return;
    setLoadingLabels(true);
    axios.get(`${API_URL}/monday/status-labels/${workspaceId}/${form.trigger_board_id}/${colId}`)
      .then(r => setStatusLabels(r.data.labels || []))
      .catch(console.error)
      .finally(() => setLoadingLabels(false));
  }, [form.trigger_config?.column_id, form.trigger_board_id, workspaceId]);

  // Load action board columns + items
  useEffect(() => {
    if (!form.action_board_id || !workspaceId) return;
    setActionColumns([]); setActionItems([]);
    getBoardColumns(workspaceId, form.action_board_id).then(setActionColumns).catch(console.error);
    getBoardItems(workspaceId, form.action_board_id).then(setActionItems).catch(console.error);
  }, [form.action_board_id, workspaceId]);

  const canNext = () => {
    if (step === 0) return !!form.trigger_type && !!form.trigger_board_id;
    if (step === 1) return true;
    if (step === 2) return !!form.action_type;
    if (step === 3) return form.name.trim().length > 0;
    return false;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        workspace_id: workspaceId, name: form.name,
        trigger_type: form.trigger_type, trigger_board_id: form.trigger_board_id,
        trigger_config: form.trigger_config,
        condition_config: form.use_condition ? form.condition_config : null,
        action_type: form.action_type, action_board_id: form.action_board_id || null,
        action_config: form.action_config,
      };
      if (isEdit && id) await updateAutomationFull(id, payload);
      else              await createAutomation(payload);
      navigate('/');
    } catch (e: any) {
      alert('Failed to save: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ textAlign:'center', padding:60 }}>⏳ Loading...</div>;

  return (
    <div style={s.container}>

      {/* Steps */}
      <div style={s.steps}>
        {STEPS.map((name, i) => (
          <div key={name} style={s.stepItem}>
            <div style={{ ...s.stepCircle,
              background: i <= step ? 'linear-gradient(135deg,#6C47FF,#4A90E2)' : '#EBECF0',
              color:      i <= step ? '#fff' : '#97A0AF' }}>
              {i < step ? '✓' : i + 1}
            </div>
            <span style={{ fontSize:12, fontWeight:600, color: i <= step ? '#6C47FF' : '#97A0AF' }}>{name}</span>
          </div>
        ))}
      </div>

      {/* ── STEP 0: TRIGGER ── */}
      {step === 0 && (
        <div style={s.card}>
          <h3 style={s.cardTitle}>🎯 Step 1 — Set Your Trigger</h3>
          <p style={s.cardSub}>What event on Board A starts this automation?</p>

          <label style={s.label}>Trigger Board</label>
          <select style={s.select} value={form.trigger_board_id}
            onChange={e => { set('trigger_board_id', e.target.value); set('trigger_config', {}); }}>
            <option value="">— Select a board —</option>
            {boards.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>

          <label style={s.label}>Trigger Type</label>
          <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:8 }}>
            {TRIGGER_TYPES.map(t => (
              <div key={t.value}
                style={{ ...s.option,
                  border:     form.trigger_type === t.value ? '2px solid #6C47FF' : '2px solid #EBECF0',
                  background: form.trigger_type === t.value ? '#F3F0FF' : '#fff' }}
                onClick={() => { set('trigger_type', t.value); set('trigger_config', {}); }}>
                <strong>{t.label}</strong>
              </div>
            ))}
          </div>

          {/* Status Change Config */}
          {form.trigger_type === 'status_change' && (
            <>
              <label style={s.label}>Status Column</label>
              <select style={s.select}
                value={form.trigger_config?.column_id || ''}
                onChange={e => set('trigger_config', { ...form.trigger_config, column_id: e.target.value, value: '' })}>
                <option value="">— Select column —</option>
                {triggerColumns.filter(c => c.type === 'status').map(c => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>

              {form.trigger_config?.column_id && (
                <>
                  <label style={s.label}>When Status Changes To</label>
                  {loadingLabels ? (
                    <p style={{ fontSize:13, color:'#6B778C' }}>⏳ Loading status options...</p>
                  ) : statusLabels.length > 0 ? (
                    <select style={s.select}
                      value={form.trigger_config?.value || ''}
                      onChange={e => set('trigger_config', { ...form.trigger_config, value: e.target.value })}>
                      <option value="">— Select status value —</option>
                      {statusLabels.map((l: any) => (
                        <option key={l.index} value={l.label}>{l.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input style={s.input}
                      placeholder="e.g. Done"
                      value={form.trigger_config?.value || ''}
                      onChange={e => set('trigger_config', { ...form.trigger_config, value: e.target.value })} />
                  )}
                </>
              )}
            </>
          )}

          {/* Item Moved Config */}
          {form.trigger_type === 'item_moved' && (
            <>
              <label style={s.label}>Destination Group</label>
              {!form.trigger_board_id ? (
                <p style={{ color:'#DE350B', fontSize:13 }}>⚠️ Select a board first</p>
              ) : triggerGroups.length === 0 ? (
                <p style={{ color:'#6B778C', fontSize:13 }}>⏳ Loading groups...</p>
              ) : (
                <select style={s.select}
                  value={form.trigger_config?.group_id || ''}
                  onChange={e => set('trigger_config', { group_id: e.target.value })}>
                  <option value="">— Select destination group —</option>
                  {triggerGroups.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
                </select>
              )}
              <div style={{ background:'#FFF8E1', border:'1px solid #FFD700', borderRadius:8, padding:12, marginTop:12 }}>
                <p style={{ margin:0, fontSize:13, color:'#FF8B00', fontWeight:600 }}>⚠️ Manual Setup Required</p>
                <p style={{ margin:'6px 0 0', fontSize:12, color:'#6B778C' }}>
                  Go to monday.com → Your Board → Automate → search "webhook"<br/>
                  Select <strong>"When item moves to group → Send webhook"</strong><br/>
                  Set URL to: <code style={{ background:'#F4F5F7', padding:'2px 6px', borderRadius:4 }}>{API_URL}/webhooks/receive</code>
                </p>
              </div>
            </>
          )}

          {/* Date Trigger Config */}
          {form.trigger_type === 'date_reached' && (
            <>
              <label style={s.label}>Date Column</label>
              <select style={s.select}
                value={form.trigger_config?.column_id || ''}
                onChange={e => set('trigger_config', { column_id: e.target.value })}>
                <option value="">— Select date column —</option>
                {triggerColumns.filter(c => c.type === 'date').map(c => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
              <div style={{ background:'#E6F4FF', border:'1px solid #4A90E2', borderRadius:8, padding:12, marginTop:12 }}>
                <p style={{ margin:0, fontSize:13, color:'#0065FF', fontWeight:600 }}>ℹ️ How Date Trigger Works</p>
                <p style={{ margin:'6px 0 0', fontSize:12, color:'#42526E' }}>
                  This automation fires automatically at midnight when an item's date column matches today's date. No manual setup required.
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── STEP 1: CONDITION ── */}
      {step === 1 && (
        <div style={s.card}>
          <h3 style={s.cardTitle}>🔍 Step 2 — Condition (Optional)</h3>
          <p style={s.cardSub}>Only run this automation if an extra condition is met.</p>

          <label style={{ display:'flex', alignItems:'center', gap:10, fontSize:14, cursor:'pointer', marginTop:8 }}>
            <input type="checkbox" checked={form.use_condition}
              onChange={e => set('use_condition', e.target.checked)}
              style={{ width:16, height:16 }} />
            <span>Only if a column equals a specific value</span>
          </label>

          {form.use_condition && (
            <>
              <label style={s.label}>Column to Check</label>
              <select style={s.select}
                value={form.condition_config?.column_id || ''}
                onChange={e => set('condition_config', { ...form.condition_config, column_id: e.target.value })}>
                <option value="">— Select column —</option>
                {triggerColumns.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>

              <label style={s.label}>Must Equal</label>
              <input style={s.input}
                placeholder="e.g. High"
                value={form.condition_config?.value || ''}
                onChange={e => set('condition_config', { ...form.condition_config, value: e.target.value })} />

              <div style={{ background:'#E6F9F0', borderRadius:8, padding:10, marginTop:12 }}>
                <p style={{ margin:0, fontSize:12, color:'#00875A' }}>
                  ✅ Automation will only fire when <strong>{
                    triggerColumns.find(c => c.id === form.condition_config?.column_id)?.title || 'selected column'
                  }</strong> equals <strong>"{form.condition_config?.value || '...'}"</strong>
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── STEP 2: ACTION ── */}
      {step === 2 && (
        <div style={s.card}>
          <h3 style={s.cardTitle}>⚡ Step 3 — Set Your Action</h3>
          <p style={s.cardSub}>What should happen automatically on Board B?</p>

          <label style={s.label}>Action Type</label>
          <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:8 }}>
            {ACTION_TYPES.map(a => (
              <div key={a.value}
                style={{ ...s.option,
                  border:     form.action_type === a.value ? '2px solid #6C47FF' : '2px solid #EBECF0',
                  background: form.action_type === a.value ? '#F3F0FF' : '#fff' }}
                onClick={() => { set('action_type', a.value); set('action_config', {}); }}>
                <strong>{a.label}</strong>
              </div>
            ))}
          </div>

          {/* Change Column + Assign Person */}
          {(form.action_type === 'change_column' || form.action_type === 'assign_person') && (
            <>
              <label style={s.label}>Target Board</label>
              <select style={s.select} value={form.action_board_id}
                onChange={e => { set('action_board_id', e.target.value); set('action_config', {}); }}>
                <option value="">— Select target board —</option>
                {boards.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>

              {form.action_board_id && (
                <>
                  <label style={s.label}>Target Item</label>
                  {actionItems.length === 0
                    ? <p style={{ fontSize:13, color:'#6B778C' }}>⏳ Loading items...</p>
                    : (
                      <select style={s.select}
                        value={form.action_config?.target_item_id || ''}
                        onChange={e => set('action_config', { ...form.action_config, target_item_id: e.target.value })}>
                        <option value="">— Select item —</option>
                        {actionItems.map((item: any) => (
                          <option key={item.id} value={item.id}>
                            {item.name} ({item.group?.title})
                          </option>
                        ))}
                      </select>
                    )
                  }

                  <label style={s.label}>Target Column</label>
                  <select style={s.select}
                    value={form.action_config?.column_id || ''}
                    onChange={e => set('action_config', { ...form.action_config, column_id: e.target.value })}>
                    <option value="">— Select column —</option>
                    {actionColumns.map(c => <option key={c.id} value={c.id}>{c.title} ({c.type})</option>)}
                  </select>
                </>
              )}
            </>
          )}

          {/* Change Column Value */}
          {form.action_type === 'change_column' && form.action_config?.column_id && (
            <>
              <label style={s.label}>New Value</label>
              <input style={s.input}
                placeholder="e.g. Done, Ready, In Progress"
                value={form.action_config?.value || ''}
                onChange={e => set('action_config', { ...form.action_config, value: e.target.value })} />
              <p style={{ fontSize:12, color:'#6B778C', marginTop:4 }}>
                For status columns, type the exact label (e.g. "Done", "Working on it", "Stuck")
              </p>
            </>
          )}

          {/* Assign Person */}
          {form.action_type === 'assign_person' && (
            <>
              {!form.action_board_id && (
                <>
                  <label style={s.label}>Target Board</label>
                  <select style={s.select} value={form.action_board_id}
                    onChange={e => set('action_board_id', e.target.value)}>
                    <option value="">— Select board —</option>
                    {boards.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </>
              )}
              <label style={s.label}>Assign To</label>
              {users.length === 0
                ? <p style={{ fontSize:13, color:'#6B778C' }}>⏳ Loading users...</p>
                : (
                  <select style={s.select}
                    value={form.action_config?.user_id || ''}
                    onChange={e => set('action_config', { ...form.action_config, user_id: e.target.value })}>
                    <option value="">— Select user —</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
                  </select>
                )
              }
            </>
          )}

          {/* Send Notification */}
          {form.action_type === 'send_notification' && (
            <>
              <label style={s.label}>Notify Users</label>
              <div style={{ border:'1px solid #DFE1E6', borderRadius:8, padding:12, maxHeight:220, overflowY:'auto' }}>
                {users.map(u => {
                  const selected = (form.action_config?.user_ids || []).includes(u.id);
                  return (
                    <label key={u.id}
                      style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 4px', cursor:'pointer', borderBottom:'1px solid #F4F5F7' }}>
                      <input type="checkbox" checked={selected}
                        onChange={e => {
                          const cur: string[] = form.action_config?.user_ids || [];
                          const updated = e.target.checked
                            ? [...cur, u.id]
                            : cur.filter((x: string) => x !== u.id);
                          set('action_config', { ...form.action_config, user_ids: updated });
                        }}
                        style={{ width:16, height:16, cursor:'pointer' }} />
                      <div>
                        <div style={{ fontSize:14, fontWeight:600, color:'#172B4D' }}>{u.name}</div>
                        <div style={{ fontSize:12, color:'#6B778C' }}>{u.email}</div>
                      </div>
                      {selected && <span style={{ marginLeft:'auto', color:'#00875A', fontSize:12, fontWeight:600 }}>✅</span>}
                    </label>
                  );
                })}
              </div>

              {(form.action_config?.user_ids || []).length > 0 && (
                <div style={{ background:'#E6F9F0', borderRadius:6, padding:'8px 12px', marginTop:8, fontSize:13, color:'#00875A' }}>
                  ✅ {(form.action_config?.user_ids || []).length} user(s) selected
                </div>
              )}

              <label style={s.label}>Notification Message</label>
              <input style={s.input}
                placeholder="e.g. Task completed! Check Board Health."
                value={form.action_config?.message || ''}
                onChange={e => set('action_config', { ...form.action_config, message: e.target.value })} />
            </>
          )}
        </div>
      )}

      {/* ── STEP 3: SAVE ── */}
      {step === 3 && (
        <div style={s.card}>
          <h3 style={s.cardTitle}>💾 Step 4 — Name & Save</h3>
          <p style={s.cardSub}>Give your automation a clear name.</p>

          <label style={s.label}>Automation Name</label>
          <input style={s.input}
            placeholder="e.g. Engineering Done → Marketing Ready"
            value={form.name}
            onChange={e => set('name', e.target.value)} />

          {/* Summary */}
          <div style={{ background:'#F8F9FA', borderRadius:10, padding:20, marginTop:20 }}>
            <h4 style={{ margin:'0 0 14px', color:'#172B4D' }}>📋 Automation Summary</h4>

            <div style={s.summaryRow}>
              <span style={s.summaryLabel}>🎯 Trigger</span>
              <span><strong>{form.trigger_type.replace(/_/g,' ')}</strong> on <strong>{boards.find(b => b.id === form.trigger_board_id)?.name}</strong></span>
            </div>

            {form.trigger_type === 'status_change' && (
              <div style={s.summaryRow}>
                <span style={s.summaryLabel}>📌 When</span>
                <span>Status <strong>{triggerColumns.find(c => c.id === form.trigger_config?.column_id)?.title}</strong> changes to <strong>"{form.trigger_config?.value}"</strong></span>
              </div>
            )}

            {form.trigger_type === 'item_moved' && (
              <div style={s.summaryRow}>
                <span style={s.summaryLabel}>📦 Group</span>
                <span><strong>{triggerGroups.find(g => g.id === form.trigger_config?.group_id)?.title}</strong></span>
              </div>
            )}

            {form.use_condition && (
              <div style={s.summaryRow}>
                <span style={s.summaryLabel}>🔍 Condition</span>
                <span><strong>{triggerColumns.find(c => c.id === form.condition_config?.column_id)?.title}</strong> = <strong>"{form.condition_config?.value}"</strong></span>
              </div>
            )}

            <div style={s.summaryRow}>
              <span style={s.summaryLabel}>⚡ Action</span>
              <span><strong>{form.action_type.replace(/_/g,' ')}</strong>{form.action_board_id ? ` on ${boards.find(b => b.id === form.action_board_id)?.name}` : ''}</span>
            </div>

            {form.action_type === 'send_notification' && (form.action_config?.user_ids || []).length > 0 && (
              <div style={s.summaryRow}>
                <span style={s.summaryLabel}>👥 Notify</span>
                <span>{(form.action_config.user_ids || []).map((uid: string) => users.find(u => u.id === uid)?.name || uid).join(', ')}</span>
              </div>
            )}

            {form.action_type === 'send_notification' && form.action_config?.message && (
              <div style={s.summaryRow}>
                <span style={s.summaryLabel}>💬 Message</span>
                <span>"{form.action_config.message}"</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:8 }}>
        {step > 0 && (
          <button style={s.backBtn} onClick={() => setStep(st => st - 1)}>← Back</button>
        )}
        <button
          style={{ ...s.nextBtn, opacity: canNext() ? 1 : 0.4, marginLeft: step === 0 ? 'auto' : 0 }}
          disabled={!canNext() || saving}
          onClick={step < 3 ? () => setStep(st => st + 1) : handleSave}>
          {step < 3 ? 'Next →' : saving ? '⏳ Saving...' : isEdit ? '✅ Update Automation' : '✅ Save Automation'}
        </button>
      </div>
    </div>
  );
};

const s: Record<string, React.CSSProperties> = {
  container:    { maxWidth:720, margin:'0 auto', padding:'24px 16px' },
  steps:        { display:'flex', justifyContent:'center', gap:40, marginBottom:32 },
  stepItem:     { display:'flex', flexDirection:'column', alignItems:'center', gap:8 },
  stepCircle:   { width:36, height:36, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:14 },
  card:         { background:'#fff', borderRadius:12, padding:28, boxShadow:'0 2px 8px rgba(0,0,0,0.08)', border:'1px solid #EBECF0', marginBottom:20 },
  cardTitle:    { margin:'0 0 6px', fontSize:20, fontWeight:700, color:'#172B4D' },
  cardSub:      { margin:'0 0 24px', fontSize:14, color:'#6B778C' },
  label:        { display:'block', fontSize:13, fontWeight:600, color:'#42526E', marginBottom:6, marginTop:16 },
  input:        { width:'100%', padding:'10px 14px', borderRadius:8, border:'1px solid #DFE1E6', fontSize:14, outline:'none', boxSizing:'border-box' },
  select:       { width:'100%', padding:'10px 14px', borderRadius:8, border:'1px solid #DFE1E6', fontSize:14, outline:'none', background:'#fff', boxSizing:'border-box', cursor:'pointer' },
  option:       { padding:'12px 16px', borderRadius:8, cursor:'pointer', fontSize:14, transition:'all 0.15s' },
  summaryRow:   { display:'flex', gap:12, marginBottom:10, fontSize:14, alignItems:'flex-start' },
  summaryLabel: { fontWeight:600, color:'#6C47FF', minWidth:110, flexShrink:0 },
  backBtn:      { background:'none', border:'1px solid #DFE1E6', borderRadius:8, padding:'10px 20px', cursor:'pointer', fontSize:14, color:'#42526E' },
  nextBtn:      { background:'linear-gradient(135deg,#6C47FF,#4A90E2)', color:'#fff', border:'none', borderRadius:8, padding:'10px 28px', cursor:'pointer', fontWeight:600, fontSize:14 },
};

export default AutomationBuilder;