import axios from 'axios';

let currentBaseUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';

const api = axios.create({
  baseURL: currentBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Resilient fallback interceptor between port 8001 and 8000
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.code === 'ERR_NETWORK' && !error.config?._retry) {
      error.config._retry = true;
      const altUrl = error.config.baseURL.includes('8001')
        ? error.config.baseURL.replace('8001', '8000')
        : error.config.baseURL.replace('8000', '8001');
      error.config.baseURL = altUrl;
      api.defaults.baseURL = altUrl;
      return api(error.config);
    }
    return Promise.reject(error);
  }
);

export const eventService = {
  getEvents: (params) => api.get('/events', { params }),
  getEvent: (id) => api.get(`/events/${id}`),
  getEventDetails: (id) => api.get(`/events/${id}/details`),
  getCategories: () => api.get('/events/categories'),
  createEvent: (data) => api.post('/events', data),
  updateEvent: (id, data) => api.put(`/events/${id}`, data),
  // Sent as the raw request body; the backend validates the bytes
  uploadImage: (id, file) =>
    api.put(`/events/${id}/image`, file, { headers: { 'Content-Type': file.type || 'application/octet-stream' } }),
  removeImage: (id) => api.delete(`/events/${id}/image`),
  getRoles: (eventId) => api.get(`/events/${eventId}/roles`),
  createRole: (data) => api.post('/roles', data),
  updateRole: (roleId, data) => api.put(`/roles/${roleId}`, data),
  deleteRole: (roleId) => api.delete(`/roles/${roleId}`),
  getZones: (eventId) => api.get(`/events/${eventId}/zones`),
  getZoneNames: (eventId) => api.get(`/events/${eventId}/zone-names`),
  createZone: (eventId, data) => api.post(`/events/${eventId}/zones`, data),
  updateZone: (zoneId, data) => api.put(`/zones/${zoneId}`, data),
  deleteZone: (zoneId) => api.delete(`/zones/${zoneId}`),
};

export const skillService = {
  getSkills: () => api.get('/skills'),
};

// Absolute URL for files the backend serves (e.g. event cover images under /uploads)
export function assetUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//.test(path)) return path;
  return new URL(api.defaults.baseURL).origin + path;
}

export const volunteerService = {
  getVolunteers: (params) => api.get('/volunteers', { params }),
  getVolunteer: (id) => api.get(`/volunteers/${id}`),
  createVolunteer: (data) => api.post('/volunteers', data),
  updateVolunteer: (id, data) => api.put(`/volunteers/${id}`, data),
  checkIn: (id) => api.post(`/volunteers/${id}/check-in`),
  checkOut: (id) => api.post(`/volunteers/${id}/check-out`),
  getAvailability: (id) => api.get(`/volunteers/${id}/availability`),
  addAvailability: (id, data) => api.post(`/volunteers/${id}/availability`, data),
  updateAvailability: (availId, data) => api.put(`/volunteers/availability/${availId}`, data),
  deleteAvailability: (availId) => api.delete(`/volunteers/availability/${availId}`),
};

export const shiftService = {
  getShifts: (eventId) => api.get(`/events/${eventId}/shifts`),
  createShift: (data) => api.post('/shifts', data),
  assignVolunteer: (shiftId, volunteerId) =>
    api.post('/shifts/assign', { shift_id: shiftId, volunteer_id: volunteerId }),
  unassignVolunteer: (assignmentId) =>
    api.delete(`/shifts/assignments/${assignmentId}`),
  getRecommendations: (shiftId) =>
    api.get(`/shifts/${shiftId}/recommendations`),
  getSuggestions: (shiftId) =>
    api.get(`/shifts/${shiftId}/suggestions`),
  autoAssign: (data = {}) =>
    api.post('/assignments/auto-assign', data),
  dropout: (shiftId, volunteerId) =>
    api.post('/assignments/dropout', { shift_id: shiftId, volunteer_id: volunteerId }),
  rebalance: (data = {}) =>
    api.post('/assignments/rebalance', data),
  acceptRebalance: (data) =>
    api.post('/assignments/rebalance/accept', data),
  getAssignments: (params) =>
    api.get('/assignments', { params }),
  checkNoShows: (now = null) =>
    api.post('/assignments/no-show/check', now ? { now } : {}),
};

export const taskService = {
  getTasks: (params) => {
    if (typeof params === 'object' && params !== null) {
      return api.get('/tasks', { params });
    }
    return api.get('/tasks', { params: params ? { event_id: params } : {} });
  },
  createTask: (data) => api.post('/tasks', data),
  updateTask: (id, data) => api.put(`/tasks/${id}`, data),
  deleteTask: (id) => api.delete(`/tasks/${id}`),
};

export const issueService = {
  getIssues: (params) => api.get('/issues', { params }),
  getEscalatedIssues: () => api.get('/issues/escalated'),
  getIssue: (id) => api.get(`/issues/${id}`),
  createIssue: (data) => api.post('/issues', data),
  updateIssue: (id, data) => api.put(`/issues/${id}`, data),
  acknowledgeIssue: (id) => api.post(`/issues/${id}/acknowledge`),
  resolveIssue: (id) => api.post(`/issues/${id}/resolve`),
  checkEscalations: (now = null) => api.post('/issues/escalate/check', now ? { now } : {}),
};

export const commsService = {
  getAnnouncements: (eventIdOrParams) => {
    if (typeof eventIdOrParams === 'object' && eventIdOrParams !== null) {
      return api.get('/announcements', { params: eventIdOrParams });
    }
    if (eventIdOrParams) {
      return api.get('/announcements', { params: { event_id: eventIdOrParams } });
    }
    return api.get('/announcements');
  },
  createAnnouncement: (data) => api.post('/announcements', data),
  getEscalations: (eventId) => api.get(`/events/${eventId}/escalations`),
  createEscalation: (data) => api.post('/escalations', data),
  updateEscalation: (id, data) => api.put(`/escalations/${id}`, data),
};

export const dashboardService = {
  getMetrics: (eventId) => api.get('/dashboard/metrics', { params: { event_id: eventId } }),
};

export default api;
