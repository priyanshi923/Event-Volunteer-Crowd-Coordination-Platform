import React from 'react';
import { CalendarDays, Clock, MapPin } from 'lucide-react';
import EventCover from './EventCover';
import { VolunteerMeter } from './EventCard';
import { formatEventDate, formatEventTime } from '../../services/eventUtils';

// Large featured event: full-bleed cover with the details on a solid card on top.
export default function EventHero({ event, onOpen }) {
  const time = formatEventTime(event);
  return (
    <section className="relative overflow-hidden rounded-2xl border-2 border-white/80 shadow-brutal-lg min-h-[24rem] sm:min-h-[28rem] flex">
      <div className="absolute inset-0">
        <EventCover event={event} showInitial={false} />
      </div>

      <div className="relative self-end mt-auto m-3 sm:m-6 w-full sm:max-w-xl rounded-2xl border-2 border-white/80 bg-white p-5 sm:p-6 shadow-brutal">
        <div className="flex flex-wrap items-center gap-2">
          <span className="tag bg-brand-yellow">{event.is_featured ? 'Featured' : 'Up next'}</span>
          {event.category && <span className="tag">{event.category}</span>}
        </div>
        <h2 className="mt-3 text-2xl sm:text-4xl font-bold tracking-tight leading-tight">{event.name}</h2>
        {event.description && (
          <p className="mt-2 text-sm font-medium text-neutral-700 line-clamp-2 sm:line-clamp-3">{event.description}</p>
        )}

        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] font-bold">
          <span className="inline-flex items-center gap-1.5"><CalendarDays className="w-4 h-4" />{formatEventDate(event)}</span>
          {time && <span className="inline-flex items-center gap-1.5"><Clock className="w-4 h-4" />{time}</span>}
          {event.location && <span className="inline-flex items-center gap-1.5"><MapPin className="w-4 h-4" />{event.location}</span>}
        </div>

        <div className="mt-5 flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6">
          <button onClick={() => onOpen(event)} className="btn btn-primary h-10 px-5 self-start">
            View event
          </button>
          <VolunteerMeter event={event} className="w-full sm:flex-1" />
        </div>
      </div>
    </section>
  );
}
