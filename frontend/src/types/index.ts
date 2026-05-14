/**
 * TypeScript type definitions for Boardspell.
 * These define the shape of all data objects used in the app.
 */

/** An automation rule created by the user */
export interface Automation {
  id:               string;
  workspace_id:     string;
  name:             string;
  trigger_type:     'status_change' | 'date_reached' | 'item_moved';
  trigger_board_id: string;
  trigger_config:   Record<string, any>;
  condition_config?: Record<string, any> | null;
  action_type:      'change_column' | 'assign_person' | 'send_notification';
  action_board_id?: string;
  action_config:    Record<string, any>;
  is_active:        boolean;
  created_at:       string;
  run_count?:       number;
  last_triggered?:  string;
}

/** A log entry showing one execution of an automation */
export interface ExecutionLog {
  id:               string;
  automation_id:    string;
  triggered_at:     string;
  trigger_payload:  Record<string, any>;
  action_taken:     Record<string, any>;
  status:           'success' | 'failed' | 'skipped';
  error_message?:   string;
}

/** A monday.com board */
export interface Board {
  id:          string;
  name:        string;
  items_count: number;
}

/** A column inside a monday.com board */
export interface BoardColumn {
  id:           string;
  title:        string;
  type:         string;
  settings_str?: string;
}

/** A group (section) inside a monday.com board */
export interface BoardGroup {
  id:    string;
  title: string;
  color: string;
}

/** An item (row) inside a monday.com board */
export interface BoardItem {
  id:    string;
  name:  string;
  group: { id: string; title: string };
}

/** A monday.com user */
export interface User {
  id:          string;
  name:        string;
  email:       string;
  photo_thumb: string;
}

/** A status label option */
export interface StatusLabel {
  index: string;
  label: string;
}