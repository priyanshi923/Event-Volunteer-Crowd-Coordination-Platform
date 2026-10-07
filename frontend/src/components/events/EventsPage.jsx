import React, { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { eventService } from '../../services/api';
import { useRequest, errorMessage } from '../../services/useRequest';
import { groupEventsByTiming, pickFeatured } from '../../services/eventUtils';
import EventHero from './EventHero';
import EventSection from './EventSection';
import CategoryNav from './CategoryNav';
import EventForm from './EventForm';
import EmptyState from '../common/EmptyState';
import LoadingState from '../common/LoadingState';
import ErrorState from '../common/ErrorState';

export default function EventsPage({ onOpenEvent, onEventSaved }) {
  const [category, setCategory] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // All events (for category covers) and, when a category is chosen, the server-filtered list
  const allEvents = useRequest(() => eventService.getEvents().then((r) => r.data), [refreshKey]);
  const filtered = useRequest(
    () => (category ? eventService.getEvents({ category }).then((r) => r.data) : Promise.resolve(null)),
    [category, refreshKey]
  );
  const events = category ? filtered : allEvents;
  const categories = useRequest(() => eventService.getCategories().then((r) => r.data), [refreshKey]);

  const list = useMemo(() => events.data || [], [events.data]);
  const featured = useMemo(() => pickFeatured(list), [list]);
  const groups = useMemo(() => groupEventsByTiming(list.filter((e) => e !== featured)), [list, featured]);

  // Category bubbles use the cover of an event in that category (preferring one with an image)
  const coverFor = (name) => {
    const inCategory = (allEvents.data || []).filter((e) => (e.category || '').toLowerCase() === name.toLowerCase());
    return inCategory.find((e) => e.image_url) || inCategory[0];
  };

  const handleSaved = (event, { imageError } = {}) => {
    setShowForm(false);
    setCategory(null);
    setRefreshKey((k) => k + 1);
    if (onEventSaved) onEventSaved(event, { imageError });
  };

  const openEvent = (event) => onOpenEvent(event.id);
  const hasAnyEvents = (allEvents.data || []).length > 0;

  let body;
  if (events.loading && !events.data) {
    body = <LoadingState label="Loading events…" />;
  } else if (events.error) {
    body = <ErrorState message={`Unable to load events. ${errorMessage(events.error, '')}`.trim()} onRetry={events.reload} />;
  } else if (!list.length && !category) {
    body = (
      <EmptyState
        title="No events yet"
        description="Create your first event to start coordinating volunteers."
        action={
          <button onClick={() => setShowForm(true)} className="btn btn-primary">
            <Plus className="w-4 h-4" /> Create event
          </button>
        }
      />
    );
  } else if (!list.length) {
    body = <EmptyState title={`No events in ${category}`} description="Try another category." />;
  } else {
    body = (
      <div className="space-y-10">
        {featured && <EventHero event={featured} onOpen={openEvent} />}
        <EventSection title="Happening now" events={groups.live} onOpen={openEvent} />
        <EventSection title="Upcoming" events={groups.upcoming} onOpen={openEvent} />
        <EventSection title="Past events" events={groups.past} onOpen={openEvent} />
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Events</h1>
          <p className="page-subtitle">
            {events.data ? `${list.length} ${category ? `in ${category}` : list.length === 1 ? 'event' : 'events'}` : 'Your events and their staffing.'}
          </p>
        </div>
        {hasAnyEvents && (
          <button onClick={() => setShowForm(true)} className="btn btn-primary self-start sm:self-auto">
            <Plus className="w-4 h-4" /> Create event
          </button>
        )}
      </div>

      {categories.data && categories.data.length > 0 && (
        <div className="mb-8">
          <CategoryNav
            categories={categories.data}
            selected={category}
            onSelect={setCategory}
            coverFor={coverFor}
          />
        </div>
      )}

      {body}

      {showForm && <EventForm onClose={() => setShowForm(false)} onSaved={handleSaved} />}
    </div>
  );
}
