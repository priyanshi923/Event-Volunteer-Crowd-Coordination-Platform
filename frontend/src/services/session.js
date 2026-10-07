// session.js — Simple demo session helper (no real auth)
// Stores role and volunteer ID in localStorage for the hackathon MVP.

export const SESSION_ROLE_KEY = 'currentRole';
export const SESSION_VOL_ID_KEY = 'activeVolunteerId';
const LEGACY_VOL_ID_KEY = 'currentVolunteerId';

export function getCurrentRole() {
  return localStorage.getItem(SESSION_ROLE_KEY) || null;
}

export function getCurrentVolunteerId() {
  let id = localStorage.getItem(SESSION_VOL_ID_KEY);
  // Carry over sessions saved under the previous key
  if (!id) {
    id = localStorage.getItem(LEGACY_VOL_ID_KEY);
    if (id) {
      localStorage.setItem(SESSION_VOL_ID_KEY, id);
      localStorage.removeItem(LEGACY_VOL_ID_KEY);
    }
  }
  return id ? Number(id) : null;
}

export function setVolunteerSession(volunteerId) {
  localStorage.setItem(SESSION_ROLE_KEY, 'volunteer');
  localStorage.setItem(SESSION_VOL_ID_KEY, String(volunteerId));
}

export function setCoordinatorSession() {
  localStorage.setItem(SESSION_ROLE_KEY, 'coordinator');
  localStorage.removeItem(SESSION_VOL_ID_KEY);
}

export function clearSession() {
  localStorage.removeItem(SESSION_ROLE_KEY);
  localStorage.removeItem(SESSION_VOL_ID_KEY);
  localStorage.removeItem(LEGACY_VOL_ID_KEY);
}
