import React from 'react';
import EventCard from './EventCard';

// A titled, horizontally scrolling (swipeable on touch) row of event cards.
export default function EventSection({ title, events, onOpen }) {
  if (!events.length) return null;
  return (
    <section>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-[15px] font-semibold text-slate-700">{title}</h2>
        <span className="text-xs text-neutral-600 tabular-nums">{events.length}</span>
      </div>
      <div className="-mx-4 sm:-mx-6 px-4 sm:px-6 flex gap-4 overflow-x-auto snap-x snap-mandatory pb-3 [scrollbar-width:thin]">
        {events.map((event) => (
          <div key={event.id} className="snap-start shrink-0 w-[78%] sm:w-72">
            <EventCard event={event} onOpen={onOpen} />
          </div>
        ))}
      </div>
    </section>
  );
}
