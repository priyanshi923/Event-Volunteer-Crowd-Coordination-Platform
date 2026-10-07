import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { eventService, shiftService, skillService } from '../../services/api';
import { useRequest, errorMessage } from '../../services/useRequest';
import { eventTiming, formatEventDate, formatEventTime, STATUS_LABEL } from '../../services/eventUtils';
import EventCover from './EventCover';
import { VolunteerMeter, STATUS_BADGE } from './EventCard';
import EventForm from './EventForm';
import ZoneManager from './ZoneManager';
import RoleManager from './RoleManager';
import LoadingState from '../common/LoadingState';
import ErrorState from '../common/ErrorState';
import EmptyState from '../common/EmptyState';

const COVERAGE_TEXT = { FULL: 'text-green-700', PARTIAL: 'text-orange-700', CRITICAL: 'text-red-700' };
const ASSIGNMENT_LABEL = { ASSIGNED: 'Assigned', CHECKED_IN: 'Checked in' };

function Fact({ label, children }) {
  return (
    <div>
      <dt className="text-xs text-neutral-600">{label}</dt>
      <dd className="mt-0.5 text-[13px] text-ink">{children}</dd>
    </div>
  );
}

export default function EventDetails({ eventId, onBack, onManage, onEventSaved }) {
  const details = useRequest(() => eventService.getEventDetails(eventId).then((r) => r.data), [eventId]);
  const skills = useRequest(() => skillService.getSkills().then((r) => r.data), []);
  const [editing, setEditing] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [notice, setNotice] = useState(null);

  if (details.loading && !details.data) return <LoadingState label="Loading event…" />;
  if (details.error) {
    const notFound = details.error?.response?.status === 404;
    return notFound ? (
      <EmptyState
        title="Event not found"
        description="It may have been removed."
        action={<button onClick={onBack} className="btn btn-secondary">Back to events</button>}
      />
    ) : (
      <ErrorState message={`Unable to load this event. ${errorMessage(details.error, '')}`.trim()} onRetry={details.reload} />
    );
  }

  const event = details.data;
  const timing = eventTiming(event);
  const time = formatEventTime(event);

  const handleAutoAssign = async () => {
    setAssigning(true);
    setNotice(null);
    try {
      const res = await shiftService.autoAssign({ event_id: event.id });
      const added = (res.data.results || []).reduce((n, r) => n + (r.assigned_new_count || 0), 0);
      setNotice({ text: added > 0 ? `Assigned ${added} volunteer${added === 1 ? '' : 's'} by skill, availability, preference and workload.` : 'No eligible volunteers for the open positions.' });
      await details.reload();
    } catch (err) {
      setNotice({ text: errorMessage(err, 'Auto-assign failed.'), error: true });
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div>
      <button onClick={onBack} className="btn btn-ghost -ml-3 mb-4">
        <ArrowLeft className="w-4 h-4" /> All events
      </button>

      {/* Cover */}
      <section className="relative overflow-hidden rounded-lg border-[3px] border-ink shadow-brutal-lg h-60 sm:h-80 flex">
        <div className="absolute inset-0"><EventCover event={event} showInitial={false} /></div>
        <div className="relative self-end mt-auto m-3 sm:m-5 rounded-lg border-2 border-ink bg-white px-4 py-3 sm:px-5 sm:py-4 shadow-brutal max-w-[calc(100%-1.5rem)]">
          <div className="flex flex-wrap gap-1.5">
            <span className={`tag ${STATUS_BADGE[timing]}`}>{STATUS_LABEL[timing]}</span>
            {event.category && <span className="tag">{event.category}</span>}
            {event.is_featured && <span className="tag bg-brand-yellow">Featured</span>}
          </div>
          <h1 className="mt-2 text-2xl sm:text-4xl font-bold tracking-tight">{event.name}</h1>
        </div>
      </section>

      {/* Actions */}
      <div className="mt-5 flex flex-wrap gap-2">
        <button onClick={handleAutoAssign} disabled={assigning || event.open_positions === 0} className="btn btn-primary"
          title="Fill open shift positions using skill match, availability, preference and workload">
          {assigning ? 'Assigning…' : 'Auto-assign volunteers'}
        </button>
        <button onClick={() => onManage('shifts', event.id)} className="btn btn-secondary">Manage shifts</button>
        <button onClick={() => onManage('tasks', event.id)} className="btn btn-secondary">Tasks</button>
        <button onClick={() => onManage('issues', event.id)} className="btn btn-secondary">Issues</button>
        <button onClick={() => setEditing(true)} className="btn btn-ghost">Edit event</button>
      </div>
      {notice && <p className={`mt-3 text-[13px] ${notice.error ? 'text-red-700' : 'text-neutral-800'}`}>{notice.text}</p>}

      {/* Key facts */}
      <dl className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-6">
        <Fact label="Date">{formatEventDate(event)}</Fact>
        <Fact label="Time">{time || '—'}</Fact>
        <Fact label="Location">{event.location || '—'}</Fact>
        <Fact label="Open positions">
          <span className={event.open_positions > 0 ? 'text-orange-700' : ''}>{event.open_positions}</span>
          <span className="text-neutral-600"> across {event.shift_count} shift{event.shift_count === 1 ? '' : 's'}</span>
        </Fact>
      </dl>
      <VolunteerMeter event={event} className="mt-6 max-w-md" />
      {event.description && <p className="mt-6 text-sm text-neutral-800 leading-relaxed max-w-3xl whitespace-pre-line">{event.description}</p>}

      <div className="mt-10 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_20rem] gap-10">
        <div className="space-y-10 min-w-0">
          {/* Shifts & opportunities */}
          <section>
            <div className="flex items-baseline justify-between mb-2">
              <h2 className="section-title">Shifts</h2>
              {event.open_shifts.length > 0 && (
                <span className="text-xs text-orange-700">{event.open_shifts.length} with open positions</span>
              )}
            </div>
            {event.shifts.length === 0 ? (
              <p className="text-[13px] text-neutral-600">
                No shifts yet.{' '}
                <button onClick={() => onManage('shifts', event.id)} className="font-bold text-ink underline underline-offset-2 hover:bg-brand-yellow">
                  Create shifts
                </button>{' '}
                with required skills and headcount.
              </p>
            ) : (
              <ul className="panel divide-rows">
                {event.shifts.map((s) => (
                  <li key={s.id} className="px-4 py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13px] text-ink">{s.title}</p>
                      <p className="text-xs text-neutral-600 mt-0.5">
                        {[s.date, s.start_time && `${s.start_time}–${s.end_time}`, s.zone, s.role_name, s.required_skill].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <span className={`text-xs tabular-nums shrink-0 ${COVERAGE_TEXT[s.coverage_status] || 'text-neutral-700'}`}>
                      {s.assigned_count} of {s.capacity}
                      {s.coverage_gap > 0 && <span className="block text-right text-neutral-600">{s.coverage_gap} open</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Volunteers */}
          <section>
            <h2 className="section-title mb-2">Assigned volunteers</h2>
            {event.volunteers.length === 0 ? (
              <p className="text-[13px] text-neutral-600">No volunteers assigned to this event's shifts yet.</p>
            ) : (
              <ul className="panel divide-rows">
                {event.volunteers.map((v) => (
                  <li key={v.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4">
                    <div className="min-w-0">
                      <p className="text-[13px] text-ink">{v.name}</p>
                      <p className="text-xs text-neutral-600 truncate">{v.skills || 'No listed skills'}</p>
                    </div>
                    <p className="text-xs text-neutral-700 sm:text-right">
                      {v.shifts.map((s) => `${s.title} (${ASSIGNMENT_LABEL[s.assignment_status] || s.assignment_status})`).join(', ')}
                      <span className="block text-neutral-600">{v.status}</span>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-10">
          <ZoneManager
            eventId={event.id}
            zones={event.zones}
            usedZones={[...new Set(event.shifts.map((s) => s.zone).filter(Boolean))]}
            onChange={details.reload}
          />
          <RoleManager eventId={event.id} roles={event.roles} skills={skills.data || []} onChange={details.reload} />
        </aside>
      </div>

      {editing && (
        <EventForm
          event={event}
          onClose={() => setEditing(false)}
          onSaved={(saved, meta) => {
            setEditing(false);
            details.reload();
            if (onEventSaved) onEventSaved(saved, meta);
          }}
        />
      )}
    </div>
  );
}
