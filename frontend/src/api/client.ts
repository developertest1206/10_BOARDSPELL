import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';
const api     = axios.create({ baseURL: API_URL, headers: { 'Content-Type': 'application/json' } });

export const getAutomations      = (workspaceId: string)              => api.get(`/automations/${workspaceId}`).then(r => r.data.automations);
export const createAutomation    = (data: any)                        => api.post('/automations/', data).then(r => r.data.automation);
export const updateAutomationFull= (id: string, data: any)            => api.put(`/automations/${id}`, data).then(r => r.data.automation);
export const toggleAutomation    = (id: string, is_active: boolean)   => api.patch(`/automations/${id}`, { is_active }).then(r => r.data.automation);
export const deleteAutomation    = (id: string)                       => api.delete(`/automations/${id}`).then(r => r.data);
export const getLogs             = (automationId: string)             => api.get(`/automations/${automationId}/logs`).then(r => r.data.logs);
export const getBoards           = (workspaceId: string)              => api.get(`/monday/boards/${workspaceId}`).then(r => r.data.boards);
export const getBoardColumns     = (workspaceId: string, boardId: string) => api.get(`/monday/columns/${workspaceId}/${boardId}`).then(r => r.data.columns);
export const getBoardGroups      = (workspaceId: string, boardId: string) => api.get(`/monday/groups/${workspaceId}/${boardId}`).then(r => r.data.groups);
export const getBoardItems       = (workspaceId: string, boardId: string) => api.get(`/monday/items/${workspaceId}/${boardId}`).then(r => r.data.items);
export const getUsers            = (workspaceId: string)              => api.get(`/monday/users/${workspaceId}`).then(r => r.data.users);