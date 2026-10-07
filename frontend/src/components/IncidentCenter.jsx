import React, { useState, useEffect } from 'react';
import { Plus, Search } from 'lucide-react';
import { issueService, commsService } from '../services/api';
import Modal from './Modal';
import { useZoneNames } from '../services/useOptions';
import { parseServerDate } from '../services/dates';

const PRIORITY_DOT = {
  CRITICAL: 'bg-brand-red',
  HIGH: 'bg-brand-orange',
  MEDIUM: 'bg-brand-blue',
  LOW: 'bg-neutral-300',
};

const STATUS_TEXT = {
  OPEN: 'text-neutral-800',
  ACKNOWLEDGED: 'text-blue-700',
  RESOLVED: 'text-green-700',
};

function audienceLabel(ann) {
  const type = (ann.target_type || 'EVERYONE').toUpperCase();
  if (type === 'EVERYONE') return 'Everyone';
  if (type === 'VOLUNTEERS') return 'Volunteers';
  if (type === 'COORDINATORS') return 'Coordinators';
  return ann.target_value || type.toLowerCase();
}

const ISSUE_TYPE_CONFIG = {
  MEDICAL: { label: 'Medical', coordinator: 'First Aid Coordinator' },
  CROWD_SURGE: { label: 'Crowd surge', coordinator: 'Security Coordinator' },
  SECURITY: { label: 'Security', coordinator: 'Security Coordinator' },
  MISSING_EQUIPMENT: { label: 'Equipment', coordinator: 'Operations Coordinator' },
  OTHER: { label: 'Other', coordinator: 'Event Coordinator' },
};

export default function IncidentCenter({
  selectedEventId,
  onIncidentChange
}) {
  const [issues, setIssues] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [escalations, setEscalations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [zoneFilter, setZoneFilter] = useState('ALL');
  const zoneOptions = useZoneNames(selectedEventId);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showAnnModal, setShowAnnModal] = useState(false);

  // Forms
  const [newIssue, setNewIssue] = useState({
    title: '',
    description: '',
    zone: '',
    issue_type: 'MEDICAL',
    priority: 'HIGH',
    status: 'OPEN'
  });

  const [newAnn, setNewAnn] = useState({
    title: '',
    message: '',
    target_type: 'EVERYONE',
    target_value: '',
    priority: 'General',
    author: 'Event Coordinator'
  });

  const [checkingEscalations, setCheckingEscalations] = useState(false);

  // Time format helper
  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return '';
    const diffMs = Date.now() - parseServerDate(dateStr).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return `${Math.max(0, diffSec)}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    return `${diffHours}h ago`;
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = selectedEventId ? { event_id: selectedEventId } : {};
      const [resIssues, resAnn, resEsc] = await Promise.all([
        issueService.getIssues(params),
        commsService.getAnnouncements(selectedEventId),
        selectedEventId ? commsService.getEscalations(selectedEventId) : Promise.resolve({ data: [] })
      ]);
      setIssues(resIssues.data || []);
      setAnnouncements(resAnn.data || []);
      setEscalations(resEsc.data || []);
    } catch (err) {
      console.error("Error fetching incident center data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [selectedEventId]);

  const handleCheckEscalations = async () => {
    try {
      setCheckingEscalations(true);
      const res = await issueService.checkEscalations();
      await fetchData();
      if (res.data?.escalated_count > 0) {
        alert(`Time SLA checked: ${res.data.escalated_count} issue(s) escalated to higher command.`);
      } else {
        alert("All SLAs checked. No new escalations needed at this moment.");
      }
      if (onIncidentChange) onIncidentChange();
    } catch (err) {
      alert("Error checking escalations: " + (err.response?.data?.detail || err.message));
    } finally {
      setCheckingEscalations(false);
    }
  };

  // Create Issue
  const handleCreateIssue = async (e) => {
    e.preventDefault();
    if (!newIssue.title) return;
    try {
      await issueService.createIssue({
        ...newIssue,
        event_id: selectedEventId ? Number(selectedEventId) : null
      });
      setShowIssueModal(false);
      setNewIssue({
        title: '',
        description: '',
        zone: '',
        issue_type: 'MEDICAL',
        priority: 'HIGH',
        status: 'OPEN'
      });
      fetchData();
      if (onIncidentChange) onIncidentChange();
    } catch (err) {
      alert("Error reporting issue: " + (err.response?.data?.detail || err.message));
    }
  };

  // Acknowledge Issue
  const handleAcknowledge = async (issueId) => {
    try {
      setActionLoadingId(issueId);
      await issueService.acknowledgeIssue(issueId);
      await fetchData();
      if (onIncidentChange) onIncidentChange();
    } catch (err) {
      alert("Error acknowledging issue: " + (err.response?.data?.detail || err.message));
    } finally {
      setActionLoadingId(null);
    }
  };

  // Resolve Issue
  const handleResolve = async (issueId) => {
    try {
      setActionLoadingId(issueId);
      await issueService.resolveIssue(issueId);
      await fetchData();
      if (onIncidentChange) onIncidentChange();
    } catch (err) {
      alert("Error resolving issue: " + (err.response?.data?.detail || err.message));
    } finally {
      setActionLoadingId(null);
    }
  };

  // Create Announcement
  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    if (!newAnn.title || (!newAnn.message && !newAnn.content)) return;
    try {
      await commsService.createAnnouncement({
        ...newAnn,
        content: newAnn.message,
        event_id: selectedEventId ? Number(selectedEventId) : null
      });
      setShowAnnModal(false);
      setNewAnn({
        title: '',
        message: '',
        target_type: 'EVERYONE',
        target_value: '',
        priority: 'General',
        author: 'Event Coordinator'
      });
      fetchData();
      if (onIncidentChange) onIncidentChange();
    } catch (err) {
      alert("Error broadcasting announcement: " + (err.response?.data?.detail || err.message));
    }
  };

  const openCriticalCount = issues.filter((i) => i.status === 'OPEN' && i.priority === 'CRITICAL').length;
  const openHighCount = issues.filter((i) => i.status === 'OPEN' && i.priority === 'HIGH').length;
  const escalatedCount = issues.filter((i) => (i.escalation_level > 0 || i.is_escalated) && i.status !== 'RESOLVED').length;
  const totalOpenCount = issues.filter((i) => i.status === 'OPEN').length;

  // Filter issues for display
  const filteredIssues = issues.filter((i) => {
    if (statusFilter === 'ESCALATED') {
      if (!(i.escalation_level > 0 || i.is_escalated)) return false;
    } else if (statusFilter !== 'ALL' && i.status !== statusFilter) {
      return false;
    }
    if (typeFilter !== 'ALL' && i.issue_type !== typeFilter) return false;
    if (priorityFilter !== 'ALL' && i.priority !== priorityFilter) return false;
    if (zoneFilter !== 'ALL' && i.zone !== zoneFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTitle = (i.title || '').toLowerCase().includes(q);
      const matchDesc = (i.description || '').toLowerCase().includes(q);
      const matchCoord = (i.assigned_coordinator || '').toLowerCase().includes(q);
      const matchZone = (i.zone || '').toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchCoord && !matchZone) return false;
    }
    return true;
  });

  const statusTabs = [
    ['ALL', 'All', issues.length],
    ['OPEN', 'Open', totalOpenCount],
    ['ESCALATED', 'Escalated', issues.filter((i) => i.escalation_level > 0 || i.is_escalated).length],
    ['ACKNOWLEDGED', 'Acknowledged', issues.filter((i) => i.status === 'ACKNOWLEDGED').length],
    ['RESOLVED', 'Resolved', issues.filter((i) => i.status === 'RESOLVED').length],
  ];

  const formatClock = (dateStr) =>
    dateStr ? parseServerDate(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Issues</h1>
          <p className="page-subtitle">
            {totalOpenCount} open
            {openCriticalCount > 0 && <> · <span className="text-red-700">{openCriticalCount} critical</span></>}
            {openHighCount > 0 && <> · {openHighCount} high</>}
            {escalatedCount > 0 && <> · <span className="text-red-700">{escalatedCount} escalated</span></>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleCheckEscalations}
            disabled={checkingEscalations}
            title="Escalate unacknowledged issues past their response time"
            className="btn btn-secondary"
          >
            {checkingEscalations ? 'Checking…' : 'Check escalations'}
          </button>
          <button onClick={() => setShowAnnModal(true)} className="btn btn-secondary">
            New announcement
          </button>
          <button onClick={() => setShowIssueModal(true)} className="btn btn-primary">
            <Plus className="w-4 h-4" /> Report issue
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_20rem] gap-10">
        {/* Issue queue */}
        <section className="min-w-0">
          <div className="segmented mb-3 overflow-x-auto max-w-full">
            {statusTabs.map(([value, label, count]) => (
              <button key={value} aria-pressed={statusFilter === value} onClick={() => setStatusFilter(value)}>
                {label} <span className="text-neutral-600 tabular-nums ml-0.5">{count}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-neutral-600 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search issues"
                className="input input-sm pl-8"
              />
            </div>
            <div className="grid grid-cols-3 gap-2 sm:flex">
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="input input-sm sm:w-32" title="Type">
                <option value="ALL">All types</option>
                {Object.entries(ISSUE_TYPE_CONFIG).map(([value, cfg]) => (
                  <option key={value} value={value}>{cfg.label}</option>
                ))}
              </select>
              <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="input input-sm sm:w-32" title="Priority">
                <option value="ALL">All priorities</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
              <select value={zoneFilter} onChange={(e) => setZoneFilter(e.target.value)} className="input input-sm sm:w-32" title="Zone">
                <option value="ALL">All zones</option>
                {zoneOptions.map((z) => <option key={z} value={z}>{z}</option>)}
              </select>
            </div>
          </div>

          {loading && issues.length === 0 ? (
            <div className="empty">Loading issues…</div>
          ) : filteredIssues.length === 0 ? (
            <div className="empty">No issues match these filters.</div>
          ) : (
            <ul className="panel divide-rows">
              {filteredIssues.map((iss) => {
                const isResolved = iss.status === 'RESOLVED';
                const isOpen = iss.status === 'OPEN';
                const cfg = ISSUE_TYPE_CONFIG[iss.issue_type] || ISSUE_TYPE_CONFIG.OTHER;
                const escalated = iss.escalation_level > 0 || iss.is_escalated;

                return (
                  <li key={iss.id} className={`px-4 py-3.5 ${isResolved ? 'opacity-60' : ''}`}>
                    <div className="flex items-start gap-3">
                      <span className={`dot mt-1.5 ${PRIORITY_DOT[iss.priority] || 'bg-neutral-300'}`} title={iss.priority} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-[13px] text-ink">{iss.title}</p>
                          <span className={`text-xs shrink-0 ${STATUS_TEXT[iss.status] || 'text-neutral-700'}`}>
                            {iss.status.charAt(0) + iss.status.slice(1).toLowerCase()}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-600 mt-0.5">
                          {cfg.label} · {iss.zone} · {iss.assigned_coordinator}
                          {iss.created_at && <> · {formatClock(iss.created_at)}</>}
                        </p>
                        {escalated && !isResolved && (
                          <p className="text-xs text-red-700 mt-0.5">
                            Escalated to {iss.escalation_tier || `level ${iss.escalation_level}`}
                            {iss.escalated_at && <> {formatTimeAgo(iss.escalated_at)}</>}
                            {iss.original_assigned_coordinator && iss.original_assigned_coordinator !== iss.assigned_coordinator && (
                              <span className="text-neutral-600"> · originally {iss.original_assigned_coordinator}</span>
                            )}
                          </p>
                        )}
                        {iss.description && (
                          <p className="text-xs text-neutral-700 mt-1.5 line-clamp-2">{iss.description}</p>
                        )}

                        {!isResolved && (
                          <div className="mt-2.5 flex items-center gap-1.5">
                            {isOpen && (
                              <button
                                onClick={() => handleAcknowledge(iss.id)}
                                disabled={actionLoadingId === iss.id}
                                title="Acknowledging stops further escalation"
                                className="btn btn-secondary btn-sm"
                              >
                                Acknowledge
                              </button>
                            )}
                            <button
                              onClick={() => handleResolve(iss.id)}
                              disabled={actionLoadingId === iss.id}
                              className="btn btn-ghost btn-sm"
                            >
                              Resolve
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Announcements */}
        <section>
          <div className="flex items-center justify-between mb-3 h-8">
            <h2 className="section-title">Announcements</h2>
          </div>
          {loading && announcements.length === 0 ? (
            <div className="empty">Loading…</div>
          ) : announcements.length === 0 ? (
            <p className="text-[13px] text-neutral-600">No announcements yet.</p>
          ) : (
            <ul className="divide-rows">
              {announcements.map((ann) => {
                const priority = ann.priority || 'General';
                const priorityClass = priority === 'Critical Alert' || priority === 'CRITICAL'
                  ? 'text-red-700'
                  : priority === 'High' || priority === 'HIGH'
                  ? 'text-orange-700'
                  : '';
                return (
                  <li key={ann.id} className="py-3 first:pt-0">
                    <p className="text-[13px] text-ink">{ann.title}</p>
                    <p className="text-xs text-neutral-700 mt-1 leading-relaxed">{ann.message || ann.content}</p>
                    <p className="text-[11px] text-neutral-600 mt-1.5">
                      {audienceLabel(ann)}
                      {priorityClass && <> · <span className={priorityClass}>{priority}</span></>}
                      {' · '}{ann.author || 'Event Coordinator'}
                      {ann.created_at && <> · {formatClock(ann.created_at)}</>}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <datalist id="incident-zone-options">
        {zoneOptions.map((z) => <option key={z} value={z} />)}
      </datalist>

      {/* Report issue */}
      {showIssueModal && (
        <Modal title="Report issue" onClose={() => setShowIssueModal(false)}>
          <form onSubmit={handleCreateIssue} className="space-y-4 pb-1">
            <div>
              <label className="label">Title</label>
              <input
                type="text"
                required
                placeholder="e.g. Barricade breach at Gate 3"
                value={newIssue.title}
                onChange={(e) => setNewIssue({ ...newIssue, title: e.target.value })}
                className="input"
              />
            </div>

            <div>
              <label className="label">Details <span className="text-neutral-500">(optional)</span></label>
              <textarea
                rows="2"
                value={newIssue.description}
                onChange={(e) => setNewIssue({ ...newIssue, description: e.target.value })}
                className="input"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Type</label>
                <select
                  value={newIssue.issue_type}
                  onChange={(e) => setNewIssue({ ...newIssue, issue_type: e.target.value })}
                  className="input"
                >
                  {Object.entries(ISSUE_TYPE_CONFIG).map(([value, cfg]) => (
                    <option key={value} value={value}>{cfg.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Priority</label>
                <select
                  value={newIssue.priority}
                  onChange={(e) => setNewIssue({ ...newIssue, priority: e.target.value })}
                  className="input"
                >
                  <option value="CRITICAL">Critical</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
              </div>
            </div>

            <div>
              <label className="label">Zone</label>
<input
                type="text"
                required
                list="incident-zone-options"
                value={newIssue.zone}
                onChange={(e) => setNewIssue({ ...newIssue, zone: e.target.value })}
                className="input"
              />
            </div>

            <p className="text-xs text-neutral-600">
              Routes to {ISSUE_TYPE_CONFIG[newIssue.issue_type]?.coordinator || 'Event Coordinator'}.
            </p>

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setShowIssueModal(false)} className="btn btn-ghost">Cancel</button>
              <button type="submit" className="btn btn-primary">Report issue</button>
            </div>
          </form>
        </Modal>
      )}

      {/* New announcement */}
      {showAnnModal && (
        <Modal title="New announcement" onClose={() => setShowAnnModal(false)}>
          <form onSubmit={handleCreateAnnouncement} className="space-y-4 pb-1">
            <div>
              <label className="label">Title</label>
              <input
                type="text"
                required
                placeholder="e.g. Heat advisory this afternoon"
                value={newAnn.title}
                onChange={(e) => setNewAnn({ ...newAnn, title: e.target.value })}
                className="input"
              />
            </div>

            <div>
              <label className="label">Message</label>
              <textarea
                rows="3"
                required
                value={newAnn.message}
                onChange={(e) => setNewAnn({ ...newAnn, message: e.target.value })}
                className="input"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Audience</label>
                <select
                  value={newAnn.target_type}
                  onChange={(e) => setNewAnn({ ...newAnn, target_type: e.target.value })}
                  className="input"
                >
                  <option value="EVERYONE">Everyone</option>
                  <option value="VOLUNTEERS">Volunteers</option>
                  <option value="COORDINATORS">Coordinators</option>
                  <option value="ZONE">One zone</option>
                </select>
              </div>
              <div>
                <label className="label">Priority</label>
                <select
                  value={newAnn.priority}
                  onChange={(e) => setNewAnn({ ...newAnn, priority: e.target.value })}
                  className="input"
                >
                  <option value="General">General</option>
                  <option value="High">High</option>
                  <option value="Critical Alert">Critical</option>
                </select>
              </div>
            </div>

            {newAnn.target_type === 'ZONE' && (
              <div>
                <label className="label">Zone</label>
                <input
                  type="text"
                  required
                  list="incident-zone-options"
                  value={newAnn.target_value}
                  onChange={(e) => setNewAnn({ ...newAnn, target_value: e.target.value })}
                  className="input"
                />
                <p className="text-xs text-neutral-600 mt-1.5">Only volunteers assigned to this zone will see it.</p>
              </div>
            )}

            <div>
              <label className="label">From</label>
              <input
                type="text"
                value={newAnn.author}
                onChange={(e) => setNewAnn({ ...newAnn, author: e.target.value })}
                className="input"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setShowAnnModal(false)} className="btn btn-ghost">Cancel</button>
              <button type="submit" className="btn btn-primary">Send</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
