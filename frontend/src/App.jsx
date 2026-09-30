import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import EventSetup from './components/EventSetup';
import ShiftAssignment from './components/ShiftAssignment';
import VolunteerRoster from './components/VolunteerRoster';
import TaskBoard from './components/TaskBoard';
import IncidentCenter from './components/IncidentCenter';

import { eventService, dashboardService, volunteerService } from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
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
      // 1. Fetch Events
      const eventsRes = await eventService.getEvents();
      setEvents(eventsRes.data);
      setBackendConnected(true);

      let currentId = selectedEventId;
      if (!currentId && eventsRes.data.length > 0) {
        currentId = eventsRes.data[0].id;
        setSelectedEventId(currentId);
      }

      // 2. Fetch Metrics & Volunteers
      if (currentId) {
        const [metricsRes, volRes] = await Promise.all([
          dashboardService.getMetrics(currentId),
          volunteerService.getVolunteers()
        ]);
        setMetrics(metricsRes.data);
        setVolunteers(volRes.data);
      }
    } catch (err) {
      console.error("Backend connection check:", err);
      setBackendConnected(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, [selectedEventId]);

  const handleResetDemo = async () => {
    try {
      await dashboardService.seedDemo();
      await loadInitialData();
      showToast("Demo data reloaded successfully!");
    } catch (err) {
      showToast("Seed failed: " + err.message);
    }
  };

  const handleRefresh = async () => {
    await loadInitialData();
    showToast("Data refreshed!");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-indigo-600 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xl shadow-indigo-600/30 flex items-center gap-2 animate-bounce">
          <span>{toastMessage}</span>
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
      />

      {/* Offline Alert Banner */}
      {!backendConnected && (
        <div className="bg-rose-950/60 border-b border-rose-500/30 text-rose-300 text-xs px-4 py-2 text-center">
          ⚠️ Backend API not reachable on <code className="bg-slate-900 px-1 py-0.5 rounded">http://127.0.0.1:8000</code>. Ensure FastAPI server is running with <code className="bg-slate-900 px-1 py-0.5 rounded">python -m uvicorn main:app --reload</code>.
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'dashboard' && (
          <Dashboard
            metrics={metrics}
            events={events}
            selectedEventId={selectedEventId}
            setActiveTab={setActiveTab}
            onResetDemo={handleResetDemo}
          />
        )}

        {activeTab === 'events' && (
          <EventSetup
            events={events}
            selectedEventId={selectedEventId}
            onEventCreated={(ev) => {
              setEvents([ev, ...events]);
              setSelectedEventId(ev.id);
              showToast(`Event "${ev.name}" created!`);
            }}
            onRoleCreated={() => {
              showToast("New role quota created!");
              loadInitialData();
            }}
          />
        )}

        {activeTab === 'shifts' && (
          <ShiftAssignment
            selectedEventId={selectedEventId}
            volunteers={volunteers}
            onAssignmentChange={() => {
              loadInitialData();
              showToast("Shift assignment updated!");
            }}
          />
        )}

        {activeTab === 'volunteers' && (
          <VolunteerRoster
            onStatusChange={() => {
              loadInitialData();
              showToast("Volunteer roster updated!");
            }}
          />
        )}

        {activeTab === 'tasks' && (
          <TaskBoard
            selectedEventId={selectedEventId}
            volunteers={volunteers}
            onTaskChange={() => {
              loadInitialData();
              showToast("Task board updated!");
            }}
          />
        )}

        {activeTab === 'incidents' && (
          <IncidentCenter
            selectedEventId={selectedEventId}
            onIncidentChange={() => {
              loadInitialData();
              showToast("Incidents/Alerts updated!");
            }}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900/60 border-t border-slate-800 text-slate-500 text-xs py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© 2026 Event Volunteer & Crowd Coordination Platform. Hackathon MVP.</p>
          <div className="flex items-center gap-3 text-slate-400">
            <span>FastAPI + SQLite</span>
            <span>•</span>
            <span>React + Vite + Tailwind CSS</span>
            <span>•</span>
            <span>Axios & Lucide</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
