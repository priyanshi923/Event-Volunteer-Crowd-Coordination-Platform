import React, { useState } from 'react';
import { ArrowRight, ChevronRight, Plus } from 'lucide-react';
import EventForm from './events/EventForm';

const PRIORITY_DOT = {
  CRITICAL: 'bg-brand-red',
  HIGH: 'bg-brand-orange',
};

const ZONE_STATUS_DOT = {
  'Critical Surge': 'bg-brand-red',
  'Attention Needed': 'bg-brand-orange',
  Normal: 'bg-brand-green',
};

function Stat({ label, value, detail, alert, color, onClick }) {
  return (
    <button onClick={onClick} className={`card-lift ${color} text-left px-4 py-4`}>
      <p className="text-xs font-bold uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums">{value}</p>
      <p className="mt-1 text-xs font-medium">
        {detail}
        {alert && (
          <span className="ml-1 inline-block rounded border-2 border-white/80 bg-white px-1 font-bold text-red-700">{alert}</span>
        )}
      </p>
    </button>
  );
}

function Section({ title, action, onAction, children }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h2 className="section-title">{title}</h2>
        {action && (
          <button onClick={onAction} className="text-xs text-neutral-600 hover:text-slate-700 inline-flex items-center gap-0.5">
            {action} <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

export default function Dashboard({ metrics, setActiveTab, onEventCreated }) {
  const [showNewEvent, setShowNewEvent] = useState(false);

  if (!metrics) {
    return <div className="empty">Loading dashboard…</div>;
  }

  const openIssues = metrics.open_issues ?? metrics.active_escalations ?? 0;
  const criticalIssues = metrics.critical_issues ?? metrics.critical_escalations ?? 0;
  const openTasks = metrics.open_tasks ?? metrics.pending_tasks ?? 0;
  const urgent = metrics.urgent_issues || [];
  const gaps = metrics.replacement_needed_shifts || [];
  const moves = metrics.rebalancing_suggestions || [];
  const zones = metrics.zones_crowd_summary || [];

  return (
    <div className="space-y-10">
      <div className="page-header mb-0">
        <div>
          <h1 className="page-title">{metrics.active_event_id ? metrics.active_event_name : 'Dashboard'}</h1>
          <p className="page-subtitle">
            {metrics.active_event_id ? 'Live overview of staffing, tasks and issues.' : 'Create an event to start coordinating volunteers.'}
          </p>
        </div>
        <button onClick={() => setShowNewEvent(true)} className="btn btn-secondary self-start sm:self-auto">
          <Plus className="w-4 h-4" /> New event
        </button>
      </div>

      {showNewEvent && (
        <EventForm
          onClose={() => setShowNewEvent(false)}
          onSaved={(event, meta) => {
            setShowNewEvent(false);
            if (onEventCreated) onEventCreated(event, meta);
          }}
        />
      )}

      {/* Key numbers */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Stat
          label="Events"
          color="bg-brand-violet"
          value={metrics.total_events ?? 0}
          detail={`${metrics.active_events ?? 0} active · ${metrics.upcoming_events ?? 0} upcoming`}
          onClick={() => setActiveTab('events')}
        />
        <Stat
          label="Checked in"
          color="bg-brand-blue"
          value={`${metrics.checked_in_volunteers} / ${metrics.total_volunteers}`}
          detail={`${metrics.total_volunteer_hours ?? 0}h logged`}
          alert={metrics.no_shows_count > 0 && `${metrics.no_shows_count} no-shows`}
          onClick={() => setActiveTab('volunteers')}
        />
        <Stat
          label="Shifts fully staffed"
          color="bg-brand-green"
          value={`${metrics.filled_shifts} / ${metrics.total_shifts}`}
          detail={metrics.coverage_gaps_count > 0 ? null : 'No coverage gaps'}
          alert={metrics.coverage_gaps_count > 0 && `${metrics.coverage_gaps_count} open positions`}
          onClick={() => setActiveTab('shifts')}
        />
        <Stat
          label="Open tasks"
          color="bg-brand-yellow"
          value={openTasks}
          detail={`${metrics.in_progress_tasks ?? 0} in progress · ${metrics.resolved_tasks ?? metrics.done_tasks ?? 0} resolved`}
          onClick={() => setActiveTab('tasks')}
        />
        <Stat
          label="Open issues"
          color="bg-brand-pink"
          value={openIssues}
          detail={criticalIssues > 0 ? null : 'None critical'}
          alert={
            (criticalIssues > 0 || metrics.escalated_issues_count > 0) &&
            [criticalIssues > 0 && `${criticalIssues} critical`, metrics.escalated_issues_count > 0 && `${metrics.escalated_issues_count} escalated`]
              .filter(Boolean).join(' · ')
          }
          onClick={() => setActiveTab('issues')}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-10">
        {/* Urgent issues */}
        <Section title="Needs attention" action="All issues" onAction={() => setActiveTab('issues')}>
          {urgent.length === 0 ? (
            <p className="text-[13px] text-neutral-600 py-3">No urgent issues.</p>
          ) : (
            <ul className="panel divide-rows overflow-hidden">
              {urgent.map((issue) => (
                <li key={issue.id}>
                  <button
                    onClick={() => setActiveTab('issues')}
                    className="w-full flex items-start gap-3 py-2.5 text-left px-4 hover:bg-yellow-100 transition-colors"
                  >
                    <span className={`dot mt-1.5 ${PRIORITY_DOT[issue.priority] || 'bg-neutral-300'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold truncate">{issue.title}</p>
                      <p className="text-xs text-neutral-600 mt-0.5">
                        {issue.zone} · {issue.assigned_coordinator}
                        {issue.escalation_level > 0 && (
                          <span className="text-red-700"> · Escalated to {issue.escalation_tier || `L${issue.escalation_level}`}</span>
                        )}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Coverage gaps */}
        <Section title="Coverage gaps" action="Manage shifts" onAction={() => setActiveTab('shifts')}>
          {gaps.length === 0 ? (
            <p className="text-[13px] text-neutral-600 py-3">Every shift is fully staffed.</p>
          ) : (
            <ul className="panel divide-rows overflow-hidden">
              {gaps.map((sh) => {
                const top = sh.suggested_replacements?.[0];
                return (
                  <li key={sh.shift_id}>
                    <button
                      onClick={() => setActiveTab('shifts')}
                      className="w-full flex items-start justify-between gap-3 py-2.5 text-left px-4 hover:bg-yellow-100 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold truncate">{sh.shift_title}</p>
                        <p className="text-xs text-neutral-600 mt-0.5">
                          {sh.zone}
                          {top && <> · Suggested: {top.volunteer_name}</>}
                        </p>
                      </div>
                      <span className={`tag tabular-nums shrink-0 ${sh.coverage_status === 'CRITICAL' ? 'bg-brand-red' : 'bg-brand-orange'}`}>
                        {sh.coverage_gap} needed
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {moves.length > 0 && (
            <div className="mt-5">
              <p className="section-title mb-2">Suggested transfers</p>
              <ul className="panel divide-rows overflow-hidden">
                {moves.slice(0, 4).map((s, idx) => (
                  <li key={idx} className="px-4 py-2.5 text-[13px] font-medium flex items-center gap-1.5 flex-wrap">
                    <span className="text-slate-700">{s.volunteer_name}</span>
                    <span className="text-neutral-600">{s.source_zone}</span>
                    <ArrowRight className="w-3 h-3 text-neutral-500" />
                    <span className="text-neutral-600">{s.target_zone}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>
      </div>

      {/* Zones */}
      {zones.length > 0 && (
        <Section title="Zones">
          <div className="panel overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide border-b-2 border-white/60 bg-brand-yellow">
                  <th className="font-bold py-2.5 px-4">Zone</th>
                  <th className="font-bold py-2.5 px-4">Status</th>
                  <th className="font-bold py-2.5 px-4 text-right">Volunteers</th>
                  <th className="font-bold py-2.5 px-4 text-right">Open tasks</th>
                  <th className="font-bold py-2.5 px-4 text-right">Open issues</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-ink">
                {zones.map((z) => (
                  <tr key={z.zone}>
                    <td className="py-2.5 px-4 font-bold">{z.zone}</td>
                    <td className="py-2.5 px-4">
                      <span className="inline-flex items-center gap-2 text-neutral-700">
                        <span className={`dot ${ZONE_STATUS_DOT[z.status] || 'bg-neutral-300'}`} />
                        {z.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums font-medium">{z.assigned_staff}</td>
                    <td className="py-2.5 px-4 text-right tabular-nums font-medium">{z.active_tasks}</td>
                    <td className={`py-2.5 px-4 text-right tabular-nums font-bold ${z.open_incidents > 0 ? 'text-red-700' : ''}`}>
                      {z.open_incidents}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </div>
  );
}
