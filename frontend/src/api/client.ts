/**
 * API Client
 * ===========
 * All HTTP requests to the Boardspell backend go through this file.
 * Uses axios for HTTP requests.
 */

import axios from 'axios';

// Backend URL from environment variable
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// ── Automation APIs ───────────────────────────────────────────────────────────

/** Get all automations for a workspace */
export const getAutomations = (workspaceId: string) =>
  api.get(`/automations/${workspaceId}`).then(r => r.data.automations);

/** Create a new automation */
export const createAutomation = (data: any) =>
  api.post('/automations/', data).then(r => r.data.automation);

/** Update an existing automation (full update) */
export const updateAutomationFull = (id: string, data: any) =>
  api.put(`/automations/${id}`, data).then(r => r.data.automation);

/** Toggle automation between active and paused */
export const toggleAutomation = (id: string, is_active: boolean) =>
  api.patch(`/automations/${id}`, { is_active }).then(r => r.data.automation);

/** Delete an automation */
export const deleteAutomation = (id: string) =>
  api.delete(`/automations/${id}`).then(r => r.data);

/** Get execution logs for an automation */
export const getLogs = (automationId: string) =>
  api.get(`/automations/${automationId}/logs`).then(r => r.data.logs);

// ── monday.com Data APIs ──────────────────────────────────────────────────────

/** Get all boards in the workspace */
export const getBoards = (workspaceId: string) =>
  api.get(`/monday/boards/${workspaceId}`).then(r => r.data.boards);

/** Get all columns of a board */
export const getBoardColumns = (workspaceId: string, boardId: string) =>
  api.get(`/monday/columns/${workspaceId}/${boardId}`).then(r => r.data.columns);

/** Get all groups of a board */
export const getBoardGroups = (workspaceId: string, boardId: string) =>
  api.get(`/monday/groups/${workspaceId}/${boardId}`).then(r => r.data.groups);

/** Get all items of a board */
export const getBoardItems = (workspaceId: string, boardId: string) =>
  api.get(`/monday/items/${workspaceId}/${boardId}`).then(r => r.data.items);

/** Get all users in the workspace */
export const getUsers = (workspaceId: string) =>
  api.get(`/monday/users/${workspaceId}`).then(r => r.data.users);

/** Get all status label options for a status column */
export const getStatusLabels = (workspaceId: string, boardId: string, columnId: string) =>
  api.get(`/monday/status-labels/${workspaceId}/${boardId}/${columnId}`).then(r => r.data.labels);