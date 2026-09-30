import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Megaphone,
  Flame,
  ShieldCheck,
  Plus,
  MapPin,
  Clock,
  User,
  CheckCircle2,
  AlertCircle,
  HeartPulse,
  ShieldAlert,
  PackageSearch,
  HelpCircle,
  Radio,
  Filter,
  ArrowRight,
  Search,
  Check,
  Layers,
  Sparkles,
  Volume2
} from 'lucide-react';
import { issueService, commsService } from '../services/api';

const ISSUE_TYPE_CONFIG = {
  MEDICAL: {
    label: 'Medical Emergency',
    coordinator: 'First Aid Coordinator',
    icon: HeartPulse,
    badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    iconColor: 'text-rose-400'
  },
  CROWD_SURGE: {
    label: 'Crowd Surge / Bottleneck',
    coordinator: 'Security Coordinator',
    icon: Flame,
    badgeColor: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    iconColor: 'text-orange-400'
  },
  SECURITY: {
    label: 'Security & Access',
    coordinator: 'Security Coordinator',
    icon: ShieldAlert,
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    iconColor: 'text-amber-400'
  },
  MISSING_EQUIPMENT: {
    label: 'Missing Equipment',
    coordinator: 'Operations Coordinator',
    icon: PackageSearch,
    badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    iconColor: 'text-cyan-400'
  },
  OTHER: {
    label: 'General Incident',
    coordinator: 'Event Coordinator',
    icon: HelpCircle,
    badgeColor: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
    iconColor: 'text-slate-400'
  }
};

const ZONES = [
  'Main Stage',
  'North Gate',
  'South Exit',
  'Medical Tent',
  'Food Court',
  'VIP Lounge',
  'Registration',
  'General'
];

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
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showAnnModal, setShowAnnModal] = useState(false);

  // Forms
  const [newIssue, setNewIssue] = useState({
    title: '',
    description: '',
    zone: 'Main Stage',
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
  }, [selectedEventId]);

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
        zone: 'Main Stage',
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

  // Urgent issues that require immediate attention (CRITICAL or HIGH priority & OPEN status)
  const urgentIssues = issues.filter(
    (i) => (i.priority === 'CRITICAL' || i.priority === 'HIGH') && i.status === 'OPEN'
  );

  const openCriticalCount = issues.filter((i) => i.status === 'OPEN' && i.priority === 'CRITICAL').length;
  const openHighCount = issues.filter((i) => i.status === 'OPEN' && i.priority === 'HIGH').length;
  const totalOpenCount = issues.filter((i) => i.status === 'OPEN').length;

  // Filter issues for display
  const filteredIssues = issues.filter((i) => {
    if (statusFilter !== 'ALL' && i.status !== statusFilter) return false;
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

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 text-rose-300 text-xs font-semibold mb-2 border border-rose-500/20">
            <Radio className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
            Incident Response & Ground Operations Center
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2.5">
            <AlertTriangle className="w-6 h-6 text-rose-400" />
            Issues, Escalations & Announcements
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
            Auto-route incidents to specialized coordinators (First Aid, Security, Operations), monitor urgent escalations, and dispatch targeted crowd broadcasts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowAnnModal(true)}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-semibold rounded-xl border border-slate-700 flex items-center gap-2 transition-all shadow-md"
          >
            <Megaphone className="w-4 h-4 text-indigo-400" />
            <span>Broadcast Alert</span>
          </button>
          <button
            onClick={() => setShowIssueModal(true)}
            className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-lg shadow-rose-600/30 flex items-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Report Issue</span>
          </button>
        </div>
      </div>

      {/* Urgent Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-rose-950/20 border border-rose-500/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-300 uppercase tracking-wider">Critical Issues</span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center">
              <Flame className="w-4 h-4 animate-pulse" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">{openCriticalCount}</span>
            <span className="text-xs text-rose-400 font-medium">Open & Critical</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Requires immediate emergency dispatch</p>
        </div>

        <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-300 uppercase tracking-wider">High Priority</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">{openHighCount}</span>
            <span className="text-xs text-amber-400 font-medium">Urgent Open</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">High attention queue</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Open Issues</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">{totalOpenCount}</span>
            <span className="text-xs text-slate-400">of {issues.length} Logged</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Across all zones & severities</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Broadcast Feed</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <Megaphone className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">{announcements.length}</span>
            <span className="text-xs text-indigo-400">Announcements</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Everyone, Zone & Role broadcasts</p>
        </div>
      </div>

      {/* URGENT / REQUIRES ATTENTION BANNER */}
      {urgentIssues.length > 0 && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-rose-950/80 via-slate-900 to-rose-950/80 border-2 border-rose-500/60 shadow-xl shadow-rose-950/40">
          <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/40 shrink-0">
                <Flame className="w-5 h-5 animate-bounce" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold uppercase tracking-wider bg-rose-500 text-white animate-pulse">
                    Requires Attention
                  </span>
                  <span className="text-xs font-semibold text-rose-300">
                    {urgentIssues.length} Urgent Open Incident{urgentIssues.length > 1 ? 's' : ''}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  Open Critical and High-priority issues require immediate coordinator acknowledgment or resolution.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {urgentIssues.map((u) => {
              const cfg = ISSUE_TYPE_CONFIG[u.issue_type] || ISSUE_TYPE_CONFIG.OTHER;
              const TypeIcon = cfg.icon;
              return (
                <div
                  key={u.id}
                  className="p-3.5 rounded-xl bg-slate-950/80 border border-rose-500/30 flex flex-col justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            u.priority === 'CRITICAL'
                              ? 'bg-rose-500/30 text-rose-200 border-rose-400 animate-pulse'
                              : 'bg-orange-500/30 text-orange-200 border-orange-400'
                          }`}
                        >
                          {u.priority}
                        </span>
                        <span className="text-[11px] text-slate-300 font-medium inline-flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-indigo-400" />
                          {u.zone}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-500">#{u.id}</span>
                    </div>

                    <h4 className="text-sm font-bold text-white">{u.title}</h4>
                    {u.description && (
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">{u.description}</p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2 flex-wrap">
                    <div className="inline-flex items-center gap-1.5 text-xs text-indigo-300 bg-indigo-950/40 px-2 py-1 rounded-lg border border-indigo-800/40">
                      <User className="w-3.5 h-3.5 text-indigo-400" />
                      <span className="font-semibold">{u.assigned_coordinator}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAcknowledge(u.id)}
                        disabled={actionLoadingId === u.id}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-all flex items-center gap-1"
                      >
                        <Clock className="w-3 h-3" />
                        <span>Acknowledge</span>
                      </button>
                      <button
                        onClick={() => handleResolve(u.id)}
                        disabled={actionLoadingId === u.id}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-all flex items-center gap-1"
                      >
                        <Check className="w-3 h-3" />
                        <span>Resolve</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Split: Incident / Issue Queue (Left 7 Cols) & Announcements Feed (Right 5 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Issues Queue (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Flame className="w-4 h-4 text-rose-400" />
              Incident & Issue Queue ({filteredIssues.length})
            </h3>
            <span className="text-xs text-slate-500 font-mono">
              Total Logged: {issues.length}
            </span>
          </div>

          {/* Filter Bar */}
          <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search issues by title, zone, description, or coordinator..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div>
                <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="OPEN">OPEN</option>
                  <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
                  <option value="RESOLVED">RESOLVED</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">Issue Type</label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="ALL">All Types</option>
                  <option value="MEDICAL">Medical</option>
                  <option value="CROWD_SURGE">Crowd Surge</option>
                  <option value="SECURITY">Security</option>
                  <option value="MISSING_EQUIPMENT">Equipment</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">Priority</label>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="ALL">All Priorities</option>
                  <option value="CRITICAL">Critical</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">Zone</label>
                <select
                  value={zoneFilter}
                  onChange={(e) => setZoneFilter(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="ALL">All Zones</option>
                  {ZONES.map((z) => (
                    <option key={z} value={z}>{z}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Issues List */}
          {loading ? (
            <div className="p-8 text-center text-slate-400 text-xs">Loading incident feed...</div>
          ) : filteredIssues.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 text-slate-400 text-xs">
              No matching issues found for selected filters. All clear.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredIssues.map((iss) => {
                const isResolved = iss.status === 'RESOLVED';
                const isAck = iss.status === 'ACKNOWLEDGED';
                const isOpen = iss.status === 'OPEN';
                const isCritical = iss.priority === 'CRITICAL';
                const isHigh = iss.priority === 'HIGH';

                const cfg = ISSUE_TYPE_CONFIG[iss.issue_type] || ISSUE_TYPE_CONFIG.OTHER;
                const TypeIcon = cfg.icon;

                const priorityBadge = isCritical
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-black animate-pulse'
                  : isHigh
                  ? 'bg-orange-500/20 text-orange-300 border-orange-500/40 font-bold'
                  : iss.priority === 'MEDIUM'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-slate-700/30 text-slate-300 border-slate-600/40';

                return (
                  <div
                    key={iss.id}
                    className={`p-5 rounded-2xl border transition-all ${
                      isResolved
                        ? 'bg-slate-900/40 border-slate-800/80 opacity-70'
                        : isCritical && isOpen
                        ? 'bg-rose-950/20 border-rose-500/50 shadow-lg shadow-rose-950/30'
                        : 'bg-slate-900/90 border-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          {/* Issue Type */}
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border inline-flex items-center gap-1 ${cfg.badgeColor}`}>
                            <TypeIcon className="w-3 h-3" />
                            {cfg.label}
                          </span>

                          {/* Priority */}
                          <span className={`px-2 py-0.5 rounded-md text-[10px] border ${priorityBadge}`}>
                            {iss.priority}
                          </span>

                          {/* Zone */}
                          <span className="inline-flex items-center gap-1 text-slate-400 text-xs">
                            <MapPin className="w-3 h-3 text-indigo-400" />
                            {iss.zone}
                          </span>

                          <span className="text-[11px] text-slate-500 font-mono">#{iss.id}</span>
                        </div>

                        <h4 className="font-bold text-white text-sm sm:text-base">{iss.title}</h4>
                      </div>

                      {/* Status Badge */}
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold whitespace-nowrap border ${
                          isResolved
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : isAck
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}
                      >
                        {iss.status}
                      </span>
                    </div>

                    {iss.description && (
                      <p className="text-xs text-slate-300 mt-2 bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/60 leading-relaxed">
                        {iss.description}
                      </p>
                    )}

                    {/* Footer: Assigned Coordinator & Action Buttons */}
                    <div className="mt-3 pt-3 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2 flex-wrap text-xs text-slate-400">
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-950/40 text-indigo-300 border border-indigo-800/30">
                          <User className="w-3.5 h-3.5 text-indigo-400" />
                          <span className="font-semibold text-slate-200">{iss.assigned_coordinator}</span>
                        </div>

                        {iss.created_at && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                            <Clock className="w-3 h-3" />
                            {new Date(iss.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}

                        {iss.acknowledged_at && (
                          <span className="text-[10px] text-blue-400 font-medium">
                            • Ack: {new Date(iss.acknowledged_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}

                        {iss.resolved_at && (
                          <span className="text-[10px] text-emerald-400 font-medium">
                            • Resolved: {new Date(iss.resolved_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        {isOpen && (
                          <button
                            onClick={() => handleAcknowledge(iss.id)}
                            disabled={actionLoadingId === iss.id}
                            className="px-3 py-1.5 rounded-xl bg-blue-600/80 hover:bg-blue-600 text-white text-xs font-semibold transition-all flex items-center gap-1.5 shadow"
                          >
                            <Clock className="w-3.5 h-3.5" />
                            <span>Acknowledge</span>
                          </button>
                        )}

                        {!isResolved && (
                          <button
                            onClick={() => handleResolve(iss.id)}
                            disabled={actionLoadingId === iss.id}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600/80 hover:bg-emerald-600 text-white text-xs font-semibold transition-all flex items-center gap-1.5 shadow"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Resolve</span>
                          </button>
                        )}

                        {isResolved && (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-semibold px-2 py-1 rounded-lg bg-emerald-950/20 border border-emerald-500/20">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Resolved
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Announcements & Broadcast Feed (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-indigo-400" />
              Broadcast Announcements ({announcements.length})
            </h3>
            <button
              onClick={() => setShowAnnModal(true)}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Broadcast</span>
            </button>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-400 text-xs">Loading broadcast feed...</div>
          ) : announcements.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 text-slate-400 text-xs">
              No announcements broadcasted yet.
            </div>
          ) : (
            <div className="space-y-3">
              {announcements.map((ann) => {
                const isCritical = ann.priority === 'Critical Alert' || ann.priority === 'CRITICAL';
                const isHigh = ann.priority === 'High' || ann.priority === 'HIGH';

                const targetType = (ann.target_type || 'EVERYONE').toUpperCase();
                const targetValue = ann.target_value || '';

                const targetBadge = targetType === 'ZONE'
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                  : targetType === 'ROLE'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-purple-500/20 text-purple-300 border-purple-500/40';

                return (
                  <div
                    key={ann.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      isCritical
                        ? 'bg-rose-950/20 border-rose-500/40 shadow-lg shadow-rose-950/20'
                        : isHigh
                        ? 'bg-amber-950/20 border-amber-500/30'
                        : 'bg-slate-900/90 border-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Target Type Badge */}
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${targetBadge}`}>
                          {targetType === 'EVERYONE'
                            ? 'Broadcast • Everyone'
                            : `${targetType} • ${targetValue || 'Specific'}`}
                        </span>

                        {/* Priority Badge */}
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            isCritical
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                              : isHigh
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}
                        >
                          {ann.priority}
                        </span>
                      </div>

                      <span className="text-[10px] text-slate-500 font-mono">
                        {ann.created_at ? new Date(ann.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>

                    <h4 className="font-bold text-white text-sm">{ann.title}</h4>
                    <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                      {ann.message || ann.content}
                    </p>

                    <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <User className="w-3 h-3 text-indigo-400" />
                        {ann.author || 'Event Coordinator'}
                      </span>
                      <span className="text-slate-500">Radio Dispatch</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Quick Coordinator Routing Reference Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950/40 to-slate-900 border border-indigo-500/20">
            <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              Automated Coordinator Routing Rules
            </h4>
            <div className="space-y-1.5 text-xs text-slate-300">
              <div className="flex justify-between items-center py-0.5 border-b border-slate-800/60">
                <span className="text-rose-300 font-medium">MEDICAL</span>
                <span className="text-slate-200 font-bold">First Aid Coordinator</span>
              </div>
              <div className="flex justify-between items-center py-0.5 border-b border-slate-800/60">
                <span className="text-orange-300 font-medium">CROWD_SURGE</span>
                <span className="text-slate-200 font-bold">Security Coordinator</span>
              </div>
              <div className="flex justify-between items-center py-0.5 border-b border-slate-800/60">
                <span className="text-amber-300 font-medium">SECURITY</span>
                <span className="text-slate-200 font-bold">Security Coordinator</span>
              </div>
              <div className="flex justify-between items-center py-0.5 border-b border-slate-800/60">
                <span className="text-cyan-300 font-medium">MISSING_EQUIPMENT</span>
                <span className="text-slate-200 font-bold">Operations Coordinator</span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-400 font-medium">OTHER</span>
                <span className="text-slate-200 font-bold">Event Coordinator</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: REPORT NEW ISSUE */}
      {showIssueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl relative">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-1">
              <Flame className="w-5 h-5 text-rose-500" />
              Report New Issue / Incident
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Enter incident details. The issue will be automatically routed to the responsible coordinator.
            </p>

            <form onSubmit={handleCreateIssue} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Issue Title <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Barricade breach at Gate 3"
                  value={newIssue.title}
                  onChange={(e) => setNewIssue({ ...newIssue, title: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Description</label>
                <textarea
                  rows="2"
                  placeholder="Provide context, required actions, attendee status..."
                  value={newIssue.description}
                  onChange={(e) => setNewIssue({ ...newIssue, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Issue Type</label>
                  <select
                    value={newIssue.issue_type}
                    onChange={(e) => setNewIssue({ ...newIssue, issue_type: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-rose-500"
                  >
                    <option value="MEDICAL">MEDICAL</option>
                    <option value="CROWD_SURGE">CROWD_SURGE</option>
                    <option value="SECURITY">SECURITY</option>
                    <option value="MISSING_EQUIPMENT">MISSING_EQUIPMENT</option>
                    <option value="OTHER">OTHER</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Priority</label>
                  <select
                    value={newIssue.priority}
                    onChange={(e) => setNewIssue({ ...newIssue, priority: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-rose-500"
                  >
                    <option value="CRITICAL">CRITICAL (Urgent)</option>
                    <option value="HIGH">HIGH (Urgent)</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                  </select>
                </div>
              </div>

              {/* Automatic Coordinator Routing Live Preview */}
              <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-500/30">
                <span className="block text-[11px] uppercase tracking-wider font-bold text-indigo-400 mb-1">
                  Automatic Routing Preview
                </span>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-indigo-300" />
                  <span className="text-xs sm:text-sm font-bold text-white">
                    Assigned Coordinator: {ISSUE_TYPE_CONFIG[newIssue.issue_type]?.coordinator || 'Event Coordinator'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Based on rule: <span className="font-mono text-indigo-300">{newIssue.issue_type}</span> →{' '}
                  <span className="font-semibold text-slate-200">{ISSUE_TYPE_CONFIG[newIssue.issue_type]?.coordinator}</span>
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Venue Zone</label>
                <select
                  value={newIssue.zone}
                  onChange={(e) => setNewIssue({ ...newIssue, zone: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-rose-500"
                >
                  {ZONES.map((z) => (
                    <option key={z} value={z}>{z}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowIssueModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-rose-600/30 transition-all"
                >
                  Dispatch & Create Issue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: BROADCAST ANNOUNCEMENT */}
      {showAnnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl relative">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-1">
              <Megaphone className="w-5 h-5 text-indigo-400" />
              Broadcast Alert / Announcement
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Send a targeted alert to all volunteers, a specific venue zone, or a designated role team.
            </p>

            <form onSubmit={handleCreateAnnouncement} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Title <span className="text-indigo-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Weather Advisory: Afternoon Heat Index"
                  value={newAnn.title}
                  onChange={(e) => setNewAnn({ ...newAnn, title: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Message / Content <span className="text-indigo-400">*</span>
                </label>
                <textarea
                  rows="3"
                  required
                  placeholder="Type announcement instructions for staff..."
                  value={newAnn.message}
                  onChange={(e) => setNewAnn({ ...newAnn, message: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Target Type</label>
                  <select
                    value={newAnn.target_type}
                    onChange={(e) => setNewAnn({ ...newAnn, target_type: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="EVERYONE">EVERYONE (All Staff)</option>
                    <option value="ZONE">ZONE (Specific Area)</option>
                    <option value="ROLE">ROLE (Specific Team)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Priority</label>
                  <select
                    value={newAnn.priority}
                    onChange={(e) => setNewAnn({ ...newAnn, priority: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="General">General</option>
                    <option value="High">High</option>
                    <option value="Critical Alert">Critical Alert</option>
                  </select>
                </div>
              </div>

              {/* Target Value input if ZONE or ROLE */}
              {newAnn.target_type !== 'EVERYONE' && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <label className="block text-xs font-semibold text-indigo-300 mb-1">
                    {newAnn.target_type === 'ZONE' ? 'Target Zone Name' : 'Target Role / Team Name'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={newAnn.target_type === 'ZONE' ? 'e.g. North Gate' : 'e.g. First Aid Responder'}
                    value={newAnn.target_value}
                    onChange={(e) => setNewAnn({ ...newAnn, target_value: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Only volunteers in this {newAnn.target_type.toLowerCase()} will receive high-priority radio notifications.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Author / Coordinator Title</label>
                <input
                  type="text"
                  value={newAnn.author}
                  onChange={(e) => setNewAnn({ ...newAnn, author: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAnnModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-1.5"
                >
                  <Volume2 className="w-4 h-4" />
                  <span>Transmit Broadcast</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
