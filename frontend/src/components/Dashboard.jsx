import React from 'react';
import {
  Users,
  UserCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Flame,
  ShieldCheck,
  MapPin,
  ArrowUpRight,
  TrendingUp,
  RotateCcw
} from 'lucide-react';

export default function Dashboard({
  metrics,
  events,
  selectedEventId,
  setActiveTab,
  onResetDemo
}) {
  if (!metrics) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-400">
        Loading dashboard metrics...
      </div>
    );
  }

  const checkInRate = metrics.total_volunteers > 0
    ? Math.round((metrics.checked_in_volunteers / metrics.total_volunteers) * 100)
    : 0;

  const taskDoneRate = metrics.total_tasks > 0
    ? Math.round((metrics.done_tasks / metrics.total_tasks) * 100)
    : 0;

  const shiftFillRate = metrics.total_shifts > 0
    ? Math.round((metrics.filled_shifts / metrics.total_shifts) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Event Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 border border-slate-800 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold mb-3 border border-indigo-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Live Coordination Active
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {metrics.active_event_name || 'Event Management Center'}
            </h1>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl">
              Real-time situational awareness, volunteer crowd deployment, and incident response platform.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setActiveTab('shifts')}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2"
            >
              <span>Match Shifts</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveTab('incidents')}
              className="px-4 py-2 bg-rose-600/80 hover:bg-rose-600 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-lg shadow-rose-600/20 transition-all flex items-center gap-2"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>Crowd Alerts</span>
            </button>
            <button
              onClick={onResetDemo}
              title="Reset initial hackathon demo dataset"
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl border border-slate-700 transition-all flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Demo Data</span>
            </button>
          </div>
        </div>

        {/* Subtle decorative glow */}
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Volunteers */}
        <div
          onClick={() => setActiveTab('volunteers')}
          className="bg-slate-900/80 hover:bg-slate-800/80 p-5 rounded-2xl border border-slate-800 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Volunteers</span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{metrics.total_volunteers}</span>
            <span className="text-xs font-medium text-emerald-400">
              {metrics.checked_in_volunteers} Checked In
            </span>
          </div>
          <div className="mt-3 w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${checkInRate}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-slate-400">
            <span>{checkInRate}% Present ({metrics.checked_in_volunteers})</span>
            <span>{metrics.available_volunteers ?? (metrics.total_volunteers - metrics.checked_out_volunteers)} Available</span>
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-slate-400">
            <span className="text-amber-300 font-medium">⚡ {metrics.total_volunteer_hours ?? 0} Total Hours</span>
            <span>{metrics.registered_volunteers} Registered</span>
          </div>
        </div>

        {/* Shift Coverage */}
        <div
          onClick={() => setActiveTab('shifts')}
          className="bg-slate-900/80 hover:bg-slate-800/80 p-5 rounded-2xl border border-slate-800 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Shift Coverage</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{metrics.total_shifts}</span>
            <span className="text-xs font-medium text-amber-400">
              {metrics.filled_shifts} Fully Staffed
            </span>
          </div>
          <div className="mt-3 w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-amber-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${shiftFillRate}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-slate-400">
            <span>{shiftFillRate}% Filled</span>
            <span>{metrics.total_shifts - metrics.filled_shifts} Need Volunteers</span>
          </div>
        </div>

        {/* Task Progress */}
        <div
          onClick={() => setActiveTab('tasks')}
          className="bg-slate-900/80 hover:bg-slate-800/80 p-5 rounded-2xl border border-slate-800 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Live Tasks</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{metrics.total_tasks}</span>
            <span className="text-xs font-medium text-emerald-400">
              {metrics.done_tasks} Completed
            </span>
          </div>
          <div className="mt-3 w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${taskDoneRate}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-slate-400">
            <span>{metrics.in_progress_tasks} In Progress</span>
            <span>{metrics.pending_tasks} Pending</span>
          </div>
        </div>

        {/* Incident Escalations */}
        <div
          onClick={() => setActiveTab('incidents')}
          className="bg-slate-900/80 hover:bg-slate-800/80 p-5 rounded-2xl border border-slate-800 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Crowd Alerts</span>
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20">
              <Flame className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{metrics.active_escalations}</span>
            <span className="text-xs font-medium text-rose-400">
              {metrics.critical_escalations} Critical
            </span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs">
            {metrics.active_escalations === 0 ? (
              <span className="inline-flex items-center text-emerald-400 gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> All Perimeters Secure
              </span>
            ) : (
              <span className="inline-flex items-center text-rose-400 gap-1 font-medium">
                <AlertTriangle className="w-3.5 h-3.5" /> Active Incidents Under Response
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Crowd Safety & Zone Status Radar */}
      <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-2">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-indigo-400" />
              Crowd Zone Safety & Deployment Radar
            </h2>
            <p className="text-xs text-slate-400">
              Dynamic zone monitoring tracking active staff, queue bottlenecks, and open alerts across the venue.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2.5 py-1 rounded-md self-start sm:self-auto">
            {metrics.zones_crowd_summary?.length || 0} Monitored Zones
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          {metrics.zones_crowd_summary?.map((z, idx) => {
            const isCritical = z.status === 'Critical Surge';
            const isAttention = z.status === 'Attention Needed';

            const badgeBg = isCritical
              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
              : isAttention
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';

            const dotColor = isCritical
              ? 'bg-rose-400 animate-ping'
              : isAttention
              ? 'bg-amber-400'
              : 'bg-emerald-400';

            return (
              <div
                key={idx}
                className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/60 hover:border-slate-600 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-white text-sm">{z.zone}</span>
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${badgeBg}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                      {z.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-700/40 text-center">
                    <div>
                      <span className="block text-slate-400 text-[10px] uppercase font-medium">Volunteers</span>
                      <span className="text-white font-bold text-sm">{z.assigned_staff}</span>
                    </div>
                    <div>
                      <span className="block text-slate-400 text-[10px] uppercase font-medium">Open Tasks</span>
                      <span className="text-white font-bold text-sm">{z.active_tasks}</span>
                    </div>
                    <div>
                      <span className="block text-slate-400 text-[10px] uppercase font-medium">Incidents</span>
                      <span className={`font-bold text-sm ${z.open_incidents > 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                        {z.open_incidents}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 flex justify-between items-center text-xs text-slate-400">
                  <span className="text-[11px]">Crowd Flow:</span>
                  <span className="font-medium text-slate-300">
                    {isCritical ? 'High Density Bottleneck' : isAttention ? 'Moderate Flux' : 'Smooth Flow'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fast Action Shortcuts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          onClick={() => setActiveTab('volunteers')}
          className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800/80 border border-slate-700/60 hover:border-indigo-500/50 transition-all cursor-pointer flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-sm">Volunteer Gate Check-In</h3>
            <p className="text-xs text-slate-400 mt-0.5">Quickly register or toggle check-in/out status with 1-click timestamps.</p>
          </div>
        </div>

        <div
          onClick={() => setActiveTab('shifts')}
          className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800/80 border border-slate-700/60 hover:border-indigo-500/50 transition-all cursor-pointer flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-sm">Skill-Based Shift Matcher</h3>
            <p className="text-xs text-slate-400 mt-0.5">Auto-recommend CPR, crowd control, and bilingual volunteers for shifts.</p>
          </div>
        </div>

        <div
          onClick={() => setActiveTab('tasks')}
          className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800/80 border border-slate-700/60 hover:border-indigo-500/50 transition-all cursor-pointer flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-sm">Live Dispatch Kanban</h3>
            <p className="text-xs text-slate-400 mt-0.5">Organize ground tasks by venue zone, urgency, and volunteer assignment.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
