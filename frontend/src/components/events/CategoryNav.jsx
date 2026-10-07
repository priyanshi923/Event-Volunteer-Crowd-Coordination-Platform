import React from 'react';
import EventCover from './EventCover';

function CategoryBubble({ label, count, active, coverEvent, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className="group shrink-0 snap-start flex flex-col items-center gap-2 w-20"
    >
      <span
        className={`w-16 h-16 rounded-full overflow-hidden border-[3px] border-ink transition-[transform,box-shadow] duration-150 ${
          active ? 'shadow-brutal -translate-x-0.5 -translate-y-0.5' : 'group-hover:shadow-brutal-sm'
        }`}
      >
        {coverEvent ? (
          <EventCover event={coverEvent} imgClassName="transition-transform duration-300 group-hover:scale-110" />
        ) : (
          <span className="w-full h-full flex items-center justify-center bg-white text-[13px] font-bold">All</span>
        )}
      </span>
      <span className={`text-xs text-center font-bold leading-tight px-1.5 rounded ${active ? 'bg-brand-yellow' : ''}`}>
        {label}
        {count != null && <span className="block text-[11px] font-medium text-neutral-600 tabular-nums">{count}</span>}
      </span>
    </button>
  );
}

// Categories come from the API; each bubble uses a cover from that category's events.
export default function CategoryNav({ categories, selected, onSelect, coverFor }) {
  if (!categories.length) return null;
  return (
    <nav aria-label="Event categories" className="-mx-4 sm:-mx-6 px-4 sm:px-6 flex gap-3 overflow-x-auto snap-x py-1 pb-2">
      <CategoryBubble label="All" active={!selected} onClick={() => onSelect(null)} />
      {categories.map((c) => (
        <CategoryBubble
          key={c.name}
          label={c.name}
          count={c.event_count}
          active={selected?.toLowerCase() === c.name.toLowerCase()}
          coverEvent={coverFor(c.name) || { name: c.name, category: c.name }}
          onClick={() => onSelect(c.name)}
        />
      ))}
    </nav>
  );
}
