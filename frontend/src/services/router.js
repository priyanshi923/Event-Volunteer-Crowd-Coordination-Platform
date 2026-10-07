import { useCallback, useEffect, useState } from 'react';

// Minimal history-based routing for the coordinator app (no router dependency).
export function usePath() {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((to, { replace = false } = {}) => {
    if (to === window.location.pathname) return;
    if (replace) window.history.replaceState({}, '', to);
    else window.history.pushState({}, '', to);
    setPath(to);
    window.scrollTo(0, 0);
  }, []);

  return [path, navigate];
}

const TABS = ['dashboard', 'events', 'shifts', 'volunteers', 'tasks', 'issues'];

// "/events/12" -> { tab: 'events', eventId: 12 }
export function parseCoordinatorPath(path) {
  const parts = path.split('/').filter(Boolean);
  const tab = TABS.includes(parts[0]) ? parts[0] : 'dashboard';
  const eventId = tab === 'events' && /^\d+$/.test(parts[1] || '') ? Number(parts[1]) : null;
  return { tab, eventId };
}

export function tabPath(tab) {
  return tab === 'dashboard' ? '/' : `/${tab}`;
}
