import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, Send, Loader2 } from 'lucide-react';
import { githubService } from '../services/api';

const NORMAL_POLL_MS = 30000;
const FAST_POLL_MS = 5000;
const FAST_POLL_WINDOW_MS = 90000;

function runState(run) {
  if (run.status !== 'completed') return { label: run.status === 'queued' ? 'Queued' : 'Running', dot: 'bg-brand-yellow', live: true };
  switch (run.conclusion) {
    case 'success': return { label: 'Passed', dot: 'bg-brand-green' };
    case 'failure': return { label: 'Failed', dot: 'bg-brand-red' };
    case 'cancelled': return { label: 'Cancelled', dot: 'bg-neutral-300' };
    case 'skipped': return { label: 'Skipped', dot: 'bg-neutral-300' };
    default: return { label: run.conclusion || 'Done', dot: 'bg-brand-orange' };
  }
}

function timeAgo(iso) {
  if (!iso) return '';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function GitHubActionsPanel() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState(null);
  const fastUntil = useRef(0);

  const load = useCallback(async () => {
    try {
      const res = await githubService.getStatus();
      setStatus(res.data);
      setError(null);
    } catch {
      setError('Could not load GitHub Actions status from the API.');
    }
  }, []);

  useEffect(() => {
    let timer;
    const tick = async () => {
      await load();
      timer = setTimeout(tick, Date.now() < fastUntil.current ? FAST_POLL_MS : NORMAL_POLL_MS);
    };
    tick();
    return () => clearTimeout(timer);
  }, [load]);

  const sendReport = async () => {
    setSending(true);
    setNotice(null);
    try {
      await githubService.sendReport();
      setNotice({ ok: true, text: 'Runtime report sent. The workflow run will appear below in a few seconds.' });
      fastUntil.current = Date.now() + FAST_POLL_WINDOW_MS;
      setTimeout(load, 3000);
    } catch (err) {
      setNotice({ ok: false, text: err.response?.data?.detail || 'Failed to reach the API.' });
    } finally {
      setSending(false);
    }
  };

  const runs = status?.runs || [];
  const last = status?.lastDispatch;

  return (
    <section>
      <div className="flex items-center justify-between gap-3 mb-2">
        <h2 className="section-title">GitHub Actions</h2>
        {status && (
          <a href={`${status.repositoryUrl}/actions`} target="_blank" rel="noreferrer" className="text-xs text-neutral-600 hover:text-slate-700 inline-flex items-center gap-1">
            {status.repository} <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>

      <div className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b-2 border-white/60 bg-brand-violet/40">
          <p className="text-xs font-medium text-slate-700 min-w-0">
            {!status && !error && 'Connecting…'}
            {status && (status.canDispatch
              ? <>Reporting live platform state to <code className="font-bold">{status.workflow}</code> on <code className="font-bold">{status.ref}</code>{status.heartbeatMinutes > 0 && <> · heartbeat every {status.heartbeatMinutes} min</>}</>
              : <>Read-only. Add <code className="font-bold">GITHUB_TOKEN</code> to <code className="font-bold">backend/.env</code> to send runtime reports.</>)}
            {last && (
              <span className={`block mt-0.5 ${last.ok ? 'text-neutral-600' : 'text-red-700'}`}>
                Last report: {last.event} · {timeAgo(last.at)} · {last.ok ? 'dispatched' : last.error}
              </span>
            )}
          </p>
          <button
            id="github-send-report-btn"
            onClick={sendReport}
            disabled={!status?.canDispatch || sending}
            title={status?.canDispatch ? 'Trigger the runtime-report workflow with the current platform snapshot' : 'Set GITHUB_TOKEN to enable'}
            className="btn btn-sm btn-primary disabled:opacity-50 disabled:pointer-events-none"
          >
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Send report
          </button>
        </div>

        {notice && (
          <p className={`px-4 py-2 text-xs font-medium border-b-2 border-white/60 ${notice.ok ? 'bg-brand-green/50 text-slate-700' : 'bg-brand-red/50 text-red-800'}`}>{notice.text}</p>
        )}

        {error && <p className="px-4 py-3 text-[13px] text-red-700">{error}</p>}
        {status && !status.runsOk && <p className="px-4 py-3 text-[13px] text-red-700">{status.runsError}</p>}
        {status?.runsOk && runs.length === 0 && <p className="px-4 py-3 text-[13px] text-neutral-600">No workflow runs yet.</p>}

        {runs.length > 0 && (
          <ul className="divide-rows">
            {runs.map((run) => {
              const st = runState(run);
              return (
                <li key={run.id}>
                  <a href={run.url} target="_blank" rel="noreferrer" className="flex items-start justify-between gap-3 px-4 py-2.5 hover:bg-yellow-100 transition-colors">
                    <div className="min-w-0 flex items-start gap-2.5">
                      <span className={`dot mt-1 ${st.dot} ${st.live ? 'animate-pulse' : ''}`} />
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold truncate">{run.title || run.name}</p>
                        <p className="text-xs text-neutral-600 mt-0.5 truncate">
                          {run.name} · {run.branch} · {run.event.replace('_', ' ')} · {run.sha}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="tag">{st.label}</span>
                      <p className="text-[11px] text-neutral-500 mt-1">{timeAgo(run.created_at)}</p>
                    </div>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
