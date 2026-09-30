import React from 'react';
import {
  LayoutDashboard,
  Calendar,
  Clock,
  Users,
  CheckSquare,
  AlertTriangle,
  Radio,
  RefreshCw
} from 'lucide-react';

export default function Navbar({
  activeTab,
  setActiveTab,
  events,
  selectedEventId,
  setSelectedEventId,
  backendConnected,
  onRefresh
}) {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'events', label: 'Event & Roles', icon: Calendar },
    { id: 'shifts', label: 'Shift Matching', icon: Clock },
    { id: 'volunteers', label: 'Volunteers & Check-In', icon: Users },
    { id: 'tasks', label: 'Task Board', icon: CheckSquare },
    { id: 'incidents', label: 'Comms & Alerts', icon: AlertTriangle },
  ];

  const currentEvent = events.find(e => e.id === Number(selectedEventId));

  return (
    <header className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Platform Name */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-amber-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Radio className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                CrowdCoord <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">MVP</span>
              </span>
              <p className="text-[11px] text-slate-400 hidden sm:block">Event Volunteer & Crowd Coordination</p>
            </div>
          </div>

          {/* Event Selector & Backend Status */}
          <div className="flex items-center space-x-3">
            {/* Event Dropdown */}
            <div className="flex items-center bg-slate-800/80 rounded-lg p-1 border border-slate-700">
              <span className="text-xs text-slate-400 px-2 font-medium hidden md:inline">Event:</span>
              <select
                value={selectedEventId || ''}
                onChange={(e) => setSelectedEventId(Number(e.target.value))}
                className="bg-transparent text-sm text-slate-200 font-medium focus:outline-none cursor-pointer pr-2"
              >
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id} className="bg-slate-800 text-slate-100">
                    {ev.name.length > 25 ? ev.name.substring(0, 25) + '...' : ev.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Refresh Button */}
            <button
              onClick={onRefresh}
              title="Refresh Data"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* Backend connection pill */}
            <div
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                backendConnected
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  backendConnected ? 'bg-emerald-400 animate-ping' : 'bg-rose-400'
                }`}
              />
              <span className="hidden sm:inline">
                {backendConnected ? 'API Connected' : 'Offline'}
              </span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="flex space-x-1 sm:space-x-2 overflow-x-auto py-2 scrollbar-none border-t border-slate-800/60">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
