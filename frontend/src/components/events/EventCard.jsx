import React from 'react';
import { MapPin } from 'lucide-react';
import EventCover from './EventCover';
import { eventTiming, formatEventDate, formatEventTime, volunteerProgress, STATUS_LABEL } from '../../services/eventUtils';

export const STATUS_BADGE = { live: 'bg-brand-green', upcoming: 'bg-brand-blue', past: 'bg-neutral-200' };

export function VolunteerMeter({ event, className = '' }) {
  const { assigned, target, pct } = volunteerProgress(event);
  return (
    <div className={className}>
      <div className="flex items-center justify-between text-xs font-bold">
        <span>
          <span className="tabular-nums">{assigned}</span>
          {target > 0 && <span className="tabular-nums"> / {target}</span>} volunteers
        </span>
        {target > 0 && <span className="tabular-nums">{pct}%</span>}
      </div>
      {target > 0 && (
        <div className="mt-1.5 h-3 rounded-full border-2 border-ink bg-white overflow-hidden">
          <div className="h-full bg-brand-violet border-r-2 border-ink last:border-r-0" style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

export default function EventCard({ event, onOpen }) {
  const timing = eventTiming(event);
  const time = formatEventTime(event);

  return (
    <button onClick={() => onOpen(event)} className="group card-lift w-full text-left overflow-hidden">
      <div className="relative aspect-[16/10] overflow-hidden border-b-2 border-ink">
        <EventCover event={event} imgClassName="transition-transform duration-300 group-hover:scale-[1.04]" />
        <span className={`absolute top-2.5 left-2.5 tag ${STATUS_BADGE[timing]}`}>{STATUS_LABEL[timing]}</span>
        {event.is_featured && <span className="absolute top-2.5 right-2.5 tag bg-brand-yellow">Featured</span>}
      </div>

      <div className="p-4">
        {event.category && <p className="text-[11px] font-bold uppercase tracking-wide text-violet-700">{event.category}</p>}
        <h3 className="mt-1 text-base font-bold leading-snug line-clamp-2">{event.name}</h3>
        <p className="mt-1.5 text-xs font-medium text-neutral-700">
          {formatEventDate(event)}
          {time && <> · {time}</>}
        </p>
        {event.location && (
          <p className="mt-1 text-xs font-medium text-neutral-700 flex items-center gap-1 truncate">
            <MapPin className="w-3 h-3 shrink-0" />
            <span className="truncate">{event.location}</span>
          </p>
        )}
        <VolunteerMeter event={event} className="mt-4" />
      </div>
    </button>
  );
}
