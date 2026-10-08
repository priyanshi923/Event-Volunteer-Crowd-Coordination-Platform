import React from 'react';
import { RefreshCw, LogOut } from 'lucide-react';

export default function Navbar({
  activeTab,
  setActiveTab,
  events,
  selectedEventId,
  setSelectedEventId,
  backendConnected,
  onRefresh,
  onSwitchRole
}) {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'events', label: 'Events' },
    { id: 'shifts', label: 'Shifts' },
    { id: 'volunteers', label: 'Volunteers' },
    { id: 'tasks', label: 'Tasks' },
    { id: 'issues', label: 'Issues' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-transparent border-b-[3px] border-white/60">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 gap-4">
          <div className="flex items-center gap-6 min-w-0">
            <span className="shrink-0 rounded-xl border-2 border-white/80 bg-brand-pink px-2 py-1 text-sm font-bold tracking-tight text-slate-700 shadow-brutal-sm -rotate-2">CrowdCoord</span>

            <nav className="hidden md:flex items-center gap-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  id={`nav-tab-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`h-9 px-3 rounded-xl border-2 text-[13px] font-bold transition-colors ${
                    activeTab === tab.id
                      ? 'border-white/60 bg-brand-yellow text-slate-700 shadow-brutal-sm'
                      : 'border-transparent text-slate-700 hover:border-white/60 hover:bg-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-1.5 min-w-0">
            {events && events.length > 0 && (
              <select
                value={selectedEventId || ''}
                onChange={(e) => setSelectedEventId(Number(e.target.value))}
                title="Active event"
                className="h-9 max-w-[11rem] sm:max-w-[16rem] truncate rounded-xl border-2 border-white/80 bg-white px-2 text-[13px] font-bold text-slate-700 shadow-brutal-sm focus:outline-none"
              >
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>{ev.name}</option>
                ))}
              </select>
            )}

            <span
              className={`dot mx-1.5 ${backendConnected ? 'bg-brand-green' : 'bg-brand-red'}`}
              title={backendConnected ? 'API connected' : 'API offline'}
            />

            <button onClick={onRefresh} title="Refresh data" className="btn btn-secondary w-9 px-0">
              <RefreshCw className="w-4 h-4" />
            </button>

            {onSwitchRole && (
              <button
                id="coordinator-switch-role-btn"
                onClick={onSwitchRole}
                title="Switch role"
                className="btn btn-secondary px-2.5"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Switch role</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile tabs */}
        <nav className="md:hidden flex gap-1 overflow-x-auto pb-2 -mx-1 px-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`h-8 px-2.5 rounded-xl border-2 text-xs font-bold whitespace-nowrap ${
                activeTab === tab.id ? 'border-white/60 bg-brand-yellow text-slate-700' : 'border-transparent text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}
