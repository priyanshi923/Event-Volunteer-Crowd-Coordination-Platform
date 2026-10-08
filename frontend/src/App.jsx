import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import ShiftAssignment from './components/ShiftAssignment';
import VolunteerRoster from './components/VolunteerRoster';
import TaskBoard from './components/TaskBoard';
import IncidentCenter from './components/IncidentCenter';
import EventsPage from './components/events/EventsPage';
import EventDetails from './components/events/EventDetails';

// Role-based entry flow components
import LandingPage from './components/LandingPage';
import CoordinatorAccess from './components/CoordinatorAccess';
import VolunteerRegistration from './components/VolunteerRegistration';
import VolunteerDashboard from './components/VolunteerDashboard';

import { eventService, dashboardService, volunteerService } from './services/api';
import { getCurrentRole, getCurrentVolunteerId, setCoordinatorSession, clearSession } from './services/session';
import { usePath, parseCoordinatorPath, tabPath } from './services/router';

// Possible app screens / flows
// 'landing' | 'coordinator-access' | 'volunteer-register' | 'volunteer-dash' | 'coordinator-dash'
// Default active event context is Event #1 (the first-created event)
function defaultEventId(events) {
  if (!events || events.length === 0) return null;
  return Math.min(...events.map((e) => e.id));
}

function resolveInitialScreen() {
  const role = getCurrentRole();
  if (role === 'coordinator') return 'coordinator-dash';
  if (role === 'volunteer' && getCurrentVolunteerId()) return 'volunteer-dash';
  return 'landing';
}

export default function App() {
  const [screen, setScreen] = useState(resolveInitialScreen);

  // Coordinator app state; the active tab (and event) live in the URL, e.g. /events/12
  const [path, navigate] = usePath();
  const { tab: activeTab, eventId: routeEventId } = parseCoordinatorPath(path);
  const setActiveTab = (tab) => navigate(tabPath(tab));
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [volunteers, setVolunteers] = useState([]);
  const [backendConnected, setBackendConnected] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadInitialData = async () => {
    try {
      const eventsRes = await eventService.getEvents();
      setEvents(eventsRes.data);
      setBackendConnected(true);

      let currentId = selectedEventId;
      if (!currentId && eventsRes.data.length > 0) {
        currentId = defaultEventId(eventsRes.data);
        setSelectedEventId(currentId);
      }

      // Load metrics even with no events, so an empty database shows zeros instead of a spinner
      const [metricsRes, volRes] = await Promise.all([
        dashboardService.getMetrics(currentId),
        volunteerService.getVolunteers()
      ]);
      setMetrics(metricsRes.data);
      setVolunteers(volRes.data);
    } catch (err) {
      console.error('Backend connection check:', err);
      setBackendConnected(false);
    }
  };

  // Load active event on mount (needed for both volunteer and coordinator flows)
  useEffect(() => {
    if (selectedEventId) return;  // already have one
    eventService.getEvents().then((res) => {
      if (res.data && res.data.length > 0) {
        setSelectedEventId(defaultEventId(res.data));
      }
    }).catch(() => {});
  }, []);

  // Only poll for coordinator dash
  useEffect(() => {
    if (screen !== 'coordinator-dash') return;
    loadInitialData();
    const interval = setInterval(loadInitialData, 10000);
    return () => clearInterval(interval);
  }, [selectedEventId, activeTab, screen]);

  const handleEventSaved = (event, { imageError } = {}) => {
    loadInitialData();
    showToast(imageError ? `Saved "${event.name}", but the cover image failed: ${imageError}` : `Saved "${event.name}"`);
  };

  // Jump from an event to one of its management screens with that event active
  const manageEvent = (tab, eventId) => {
    setSelectedEventId(eventId);
    setActiveTab(tab);
  };

  const handleRefresh = async () => {
    await loadInitialData();
    showToast('Data refreshed!');
  };

  // ── LANDING ──────────────────────────────────────────────────
  if (screen === 'landing') {
    return (
      <LandingPage
        onSelectVolunteer={() => {
          // If already has a valid volunteer session, go straight to dash
          if (getCurrentRole() === 'volunteer' && getCurrentVolunteerId()) {
            setScreen('volunteer-dash');
          } else {
            setScreen('volunteer-register');
          }
        }}
        onSelectCoordinator={() => setScreen('coordinator-access')}
      />
    );
  }

  // ── COORDINATOR ACCESS ────────────────────────────────────────
  if (screen === 'coordinator-access') {
    return (
      <CoordinatorAccess
        onContinue={() => {
          setCoordinatorSession();
          setScreen('coordinator-dash');
        }}
        onBack={() => setScreen('landing')}
      />
    );
  }

  // ── VOLUNTEER REGISTRATION ────────────────────────────────────
  if (screen === 'volunteer-register') {
    return (
      <VolunteerRegistration
        eventId={selectedEventId}
        onRegistered={(_volunteerId) => {
          // session is set inside VolunteerRegistration already
          setScreen('volunteer-dash');
        }}
        onBack={() => setScreen('landing')}
      />
    );
  }

  // ── VOLUNTEER DASHBOARD ───────────────────────────────────────
  if (screen === 'volunteer-dash') {
    return (
      <VolunteerDashboard
        selectedEventId={selectedEventId}
        onSwitchRole={() => {
          clearSession();
          setScreen('landing');
        }}
      />
    );
  }

  // ── COORDINATOR DASHBOARD (full existing app) ─────────────────
  return (
    <div className="min-h-screen flex flex-col">
      {/* Toast Notification */}
      {toastMessage && (
        <div role="status" className="fixed bottom-5 right-5 z-50 max-w-sm rounded-xl border-2 border-white/80 bg-brand-yellow px-4 py-2.5 text-[13px] font-bold text-slate-700 shadow-brutal">
          {toastMessage}
        </div>
      )}

      {/* Main Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        events={events}
        selectedEventId={selectedEventId}
        setSelectedEventId={setSelectedEventId}
        backendConnected={backendConnected}
        onRefresh={handleRefresh}
        onSwitchRole={() => {
          clearSession();
          navigate('/', { replace: true });
          setScreen('landing');
        }}
      />

      {/* Offline Alert Banner */}
      {!backendConnected && (
        <div className="border-b-2 border-white/60 bg-red-100 text-red-700 text-xs px-4 py-2 text-center">
          Can't reach the API at <code className="text-red-700">http://127.0.0.1:8001</code>. Make sure the FastAPI server is running.
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
        {activeTab === 'dashboard' && (
          <Dashboard
            metrics={metrics}
            events={events}
            selectedEventId={selectedEventId}
            setActiveTab={setActiveTab}
            onEventCreated={(event, meta) => {
              setEvents((prev) => [event, ...prev.filter((e) => e.id !== event.id)]);
              setSelectedEventId(event.id);
              handleEventSaved(event, meta);
            }}
          />
        )}

        {activeTab === 'events' && (
          routeEventId ? (
            <EventDetails
              key={routeEventId}
              eventId={routeEventId}
              onBack={() => navigate('/events')}
              onManage={manageEvent}
              onEventSaved={handleEventSaved}
            />
          ) : (
            <EventsPage
              onOpenEvent={(id) => navigate(`/events/${id}`)}
              onEventSaved={handleEventSaved}
            />
          )
        )}

        {activeTab === 'shifts' && (
          <ShiftAssignment
            selectedEventId={selectedEventId}
            volunteers={volunteers}
            onAssignmentChange={() => {
              loadInitialData();
              showToast('Shift assignment updated!');
            }}
          />
        )}

        {activeTab === 'volunteers' && (
          <VolunteerRoster
            onStatusChange={() => {
              loadInitialData();
              showToast('Volunteer roster updated!');
            }}
          />
        )}

        {activeTab === 'tasks' && (
          <TaskBoard
            selectedEventId={selectedEventId}
            volunteers={volunteers}
            onTaskChange={() => {
              loadInitialData();
              showToast('Task board updated!');
            }}
          />
        )}

        {activeTab === 'issues' && (
          <IncidentCenter
            selectedEventId={selectedEventId}
            onIncidentChange={() => {
              loadInitialData();
              showToast('Incidents/Alerts updated!');
            }}
          />
        )}
      </main>
    </div>
  );
}
