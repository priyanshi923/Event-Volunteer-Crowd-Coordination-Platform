import axios from 'axios';

let currentBaseUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8001/api';

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
  getEvents: () => api.get('/events'),
  getEvent: (id) => api.get(`/events/${id}`),
  createEvent: (data) => api.post('/events', data),
  getRoles: (eventId) => api.get(`/events/${eventId}/roles`),
  createRole: (data) => api.post('/roles', data),
};

export const volunteerService = {
  getVolunteers: (params) => api.get('/volunteers', { params }),
  getVolunteer: (id) => api.get(`/volunteers/${id}`),
  createVolunteer: (data) => api.post('/volunteers', data),
  updateVolunteer: (id, data) => api.put(`/volunteers/${id}`, data),
  checkIn: (id) => api.post(`/volunteers/${id}/check-in`),
  checkOut: (id) => api.post(`/volunteers/${id}/check-out`),
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
  getAssignments: (params) =>
    api.get('/assignments', { params }),
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

export const commsService = {
  getAnnouncements: (eventId) => api.get(`/events/${eventId}/announcements`),
  createAnnouncement: (data) => api.post('/announcements', data),
  getEscalations: (eventId) => api.get(`/events/${eventId}/escalations`),
  createEscalation: (data) => api.post('/escalations', data),
  updateEscalation: (id, data) => api.put(`/escalations/${id}`, data),
};

export const dashboardService = {
  getMetrics: (eventId) => api.get('/dashboard/metrics', { params: { event_id: eventId } }),
  seedDemo: () => api.post('/seed'),
};

export default api;
