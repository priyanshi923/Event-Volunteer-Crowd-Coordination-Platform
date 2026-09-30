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
  RotateCcw,
  Shuffle,
  ArrowRight
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
              {metrics.resolved_tasks ?? metrics.done_tasks} Resolved
            </span>
          </div>
          <div className="mt-3 w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${taskDoneRate}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-slate-400">
            <span>{metrics.open_tasks ?? metrics.pending_tasks} Open</span>
            <span>{metrics.in_progress_tasks} In Progress</span>
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-slate-400">
            <span>{metrics.resolved_tasks ?? metrics.done_tasks} Resolved</span>
            {(metrics.critical_high_open_tasks > 0) ? (
              <span className="text-rose-400 font-semibold">
                ⚡ {metrics.critical_high_open_tasks} High/Crit Open
              </span>
            ) : (
              <span className="text-slate-500">0 Critical Open</span>
            )}
          </div>
        </div>

        {/* Incident & Issue Escalations */}
        <div
          onClick={() => setActiveTab('incidents')}
          className="bg-slate-900/80 hover:bg-slate-800/80 p-5 rounded-2xl border border-slate-800 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Crowd Alerts & Issues</span>
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20">
              <Flame className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">
              {metrics.open_issues ?? metrics.active_escalations}
            </span>
            <span className="text-xs font-medium text-rose-400">
              {metrics.critical_issues ?? metrics.critical_escalations} Critical
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              {(metrics.open_issues ?? metrics.active_escalations) === 0 ? (
                <span className="inline-flex items-center text-emerald-400 gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> All Perimeters Secure
                </span>
              ) : (
                <span className="inline-flex items-center text-rose-400 gap-1 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5" /> {metrics.open_issues ?? metrics.active_escalations} Open Issues
                </span>
              )}
            </div>
            {metrics.high_priority_issues > 0 && (
              <span className="text-amber-400 font-medium text-[11px]">
                {metrics.high_priority_issues} High
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Urgent Issues Escalations Section */}
      {metrics.urgent_issues && metrics.urgent_issues.length > 0 && (
        <div className="rounded-2xl bg-gradient-to-r from-rose-950/70 via-slate-900 to-rose-950/70 border border-rose-500/40 p-5 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-rose-500/20 gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
                Urgent Issues Requiring Attention ({metrics.urgent_issues.length})
              </h2>
            </div>
            <button
              onClick={() => setActiveTab('incidents')}
              className="text-xs font-semibold text-rose-300 hover:text-white flex items-center gap-1 transition-all"
            >
              <span>Manage in Incident Center</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {metrics.urgent_issues.map((issue) => (
              <div
                key={issue.id}
                onClick={() => setActiveTab('incidents')}
                className="p-3.5 rounded-xl bg-slate-900/90 border border-rose-500/30 hover:border-rose-400 transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${
                      issue.priority === 'CRITICAL'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                        : 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                    }`}>
                      {issue.priority}
                    </span>
                    <span className="text-[11px] text-slate-400 inline-flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-indigo-400" />
                      {issue.zone}
                    </span>
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-white line-clamp-1">{issue.title}</h4>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
                  <span className="text-indigo-300 font-semibold">{issue.assigned_coordinator}</span>
                  <span className="text-rose-400 font-medium flex items-center gap-1">
                    Open <ArrowUpRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Staffing Rebalancing & Coverage Gaps Section */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-2 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
              <Shuffle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Staffing Rebalancing & Coverage Gaps
              </h2>
              <p className="text-xs text-slate-400">
                Live monitoring of headcount deficits, venue surplus, and cross-zone staff transfer opportunities.
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('shifts')}
            className="text-xs font-semibold text-indigo-400 hover:text-white flex items-center gap-1 transition-all self-start sm:self-auto"
          >
            <span>Manage Shifts & Rebalance</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 4 Mini KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
            <span className="text-[10px] uppercase font-semibold text-slate-400 block">Coverage Gaps</span>
            <span className={`text-xl font-bold ${metrics.coverage_gaps_count > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {metrics.coverage_gaps_count ?? 0}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              {metrics.coverage_gaps_count > 0 ? 'Urgent Deficits' : 'Optimal Coverage'}
            </span>
          </div>

          <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
            <span className="text-[10px] uppercase font-semibold text-slate-400 block">Understaffed Shifts</span>
            <span className={`text-xl font-bold ${metrics.understaffed_shifts_count > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
              {metrics.understaffed_shifts_count ?? 0}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Below Capacity</span>
          </div>

          <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
            <span className="text-[10px] uppercase font-semibold text-slate-400 block">Overstaffed Shifts</span>
            <span className="text-xl font-bold text-indigo-300">
              {metrics.overstaffed_shifts_count ?? 0}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Surplus Staff Available</span>
          </div>

          <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
            <span className="text-[10px] uppercase font-semibold text-slate-400 block">Rebalance Actions</span>
            <span className="text-xl font-bold text-amber-400">
              {metrics.rebalancing_suggestions?.length ?? 0}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Pending Transfers</span>
          </div>
        </div>

        {/* Zone Balance Pills */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="text-xs font-semibold text-slate-300 block mb-1.5">Understaffed Zones</span>
            <div className="flex flex-wrap gap-1.5">
              {(!metrics.understaffed_zones || metrics.understaffed_zones.length === 0) ? (
                <span className="text-emerald-400 text-xs flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> All zones adequately covered
                </span>
              ) : (
                metrics.understaffed_zones.map((zone, idx) => (
                  <span key={idx} className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                    {zone}
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="text-xs font-semibold text-slate-300 block mb-1.5">Overstaffed / Surplus Zones</span>
            <div className="flex flex-wrap gap-1.5">
              {(!metrics.overstaffed_zones || metrics.overstaffed_zones.length === 0) ? (
                <span className="text-slate-400 text-xs">No excess surplus zones</span>
              ) : (
                metrics.overstaffed_zones.map((zone, idx) => (
                  <span key={idx} className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                    {zone}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Rebalancing Suggestions or Replacement Needed List */}
        {metrics.rebalancing_suggestions && metrics.rebalancing_suggestions.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-800">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2">
              Recommended Cross-Zone Transfers
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {metrics.rebalancing_suggestions.slice(0, 4).map((s, idx) => (
                <div
                  key={idx}
                  onClick={() => setActiveTab('shifts')}
                  className="p-3 rounded-xl bg-slate-900/70 border border-slate-700/60 hover:border-amber-500/50 cursor-pointer transition-all flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white">{s.volunteer_name}</span>
                    {s.expected_coverage_improvement && (
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        {s.expected_coverage_improvement}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-300">
                    <span className="text-slate-400">{s.source_zone}</span>
                    <ArrowRight className="w-3 h-3 text-amber-400 shrink-0" />
                    <span className="text-white font-medium">{s.target_zone}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 italic line-clamp-1">
                    💡 {s.suggestion_text || s.reason}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Shifts needing replacements */}
        {metrics.replacement_needed_shifts && metrics.replacement_needed_shifts.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-800">
            <span className="text-xs font-semibold text-rose-300 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              Shifts Requiring Volunteer Replacements ({metrics.replacement_needed_shifts.length})
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {metrics.replacement_needed_shifts.slice(0, 3).map((sh) => (
                <div
                  key={sh.shift_id}
                  onClick={() => setActiveTab('shifts')}
                  className="p-2.5 rounded-lg bg-slate-900/90 border border-rose-500/30 hover:border-rose-400 cursor-pointer transition-all flex items-center justify-between"
                >
                  <div>
                    <span className="font-semibold text-white text-xs block">{sh.title}</span>
                    <span className="text-[10px] text-slate-400">{sh.zone} • Needs: {sh.required_skill}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold text-[10px] border border-rose-500/30">
                    Gap: {sh.gap}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
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
