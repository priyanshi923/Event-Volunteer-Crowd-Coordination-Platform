import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

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
};

export const taskService = {
  getTasks: (eventId) => api.get(`/events/${eventId}/tasks`),
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
