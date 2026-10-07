import { useCallback, useEffect, useRef, useState } from 'react';

// Runs an async loader and tracks loading / error / data. Re-runs when deps change.
export function useRequest(loader, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const latest = useRef(0);

  const run = useCallback(async () => {
    const id = ++latest.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await loader();
      if (id === latest.current) setState({ data, loading: false, error: null });
    } catch (err) {
      if (id === latest.current) setState((s) => ({ ...s, loading: false, error: err }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { run(); }, [run]);

  return { ...state, reload: run };
}

export function errorMessage(err, fallback = 'Something went wrong.') {
  const detail = err?.response?.data?.detail;
  if (Array.isArray(detail)) return detail.map((d) => d.msg?.replace(/^Value error, /, '')).join(' ');
  return detail || err?.message || fallback;
}
