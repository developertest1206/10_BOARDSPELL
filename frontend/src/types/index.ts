export interface Automation {
  id: string;
  workspace_id: string;
  name: string;
  trigger_type: 'status_change' | 'date_reached' | 'item_moved';
  trigger_board_id: string;
  trigger_config: Record<string, any>;
  condition_config?: Record<string, any> | null;
  action_type: 'change_column' | 'assign_person' | 'send_notification';
  action_board_id?: string;
  action_config: Record<string, any>;
  is_active: boolean;
  created_at: string;
  run_count?: number;
  last_triggered?: string;
}

export interface ExecutionLog {
  id: string;
  automation_id: string;
  triggered_at: string;
  trigger_payload: Record<string, any>;
  action_taken: Record<string, any>;
  status: 'success' | 'failed' | 'skipped';
  error_message?: string;
}

export interface Board   { id: string; name: string; }
export interface BoardColumn { id: string; title: string; type: string; }
export interface BoardGroup  { id: string; title: string; }
export interface BoardItem   { id: string; name: string; group: { id: string; title: string }; }
export interface User        { id: string; name: string; email: string; }