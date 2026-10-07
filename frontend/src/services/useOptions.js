import { eventService, skillService } from './api';
import { useRequest } from './useRequest';

// Zone names for an event: zones defined on the event plus any already used by its shifts, tasks or issues.
export function useZoneNames(eventId) {
  const { data } = useRequest(
    () => (eventId ? eventService.getZoneNames(eventId).then((r) => r.data) : Promise.resolve([])),
    [eventId]
  );
  return data || [];
}

// Skill vocabulary from roles, shifts and volunteer profiles.
export function useSkills() {
  const { data } = useRequest(() => skillService.getSkills().then((r) => r.data), []);
  return data || [];
}
