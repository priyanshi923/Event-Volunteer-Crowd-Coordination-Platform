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
  AlertCircle
} from 'lucide-react';
import { commsService } from '../services/api';

export default function IncidentCenter({
  selectedEventId,
  onIncidentChange
}) {
  const [announcements, setAnnouncements] = useState([]);
  const [escalations, setEscalations] = useState([]);
  const [loading, setLoading] = useState(false);

  // Modals
  const [showAnnModal, setShowAnnModal] = useState(false);
  const [showEscModal, setShowEscModal] = useState(false);

  // Forms
  const [newAnn, setNewAnn] = useState({
    title: '',
    content: '',
    priority: 'General',
    author: 'Event Coordinator'
  });

  const [newEsc, setNewEsc] = useState({
    zone: 'North Gate',
    title: '',
    description: '',
    severity: 'Medium',
    reported_by: 'Crowd Marshal'
  });

  const fetchData = async () => {
    if (!selectedEventId) return;
    try {
      setLoading(true);
      const [resAnn, resEsc] = await Promise.all([
        commsService.getAnnouncements(selectedEventId),
        commsService.getEscalations(selectedEventId)
      ]);
      setAnnouncements(resAnn.data);
      setEscalations(resEsc.data);
    } catch (err) {
      console.error("Error fetching announcements/escalations:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedEventId]);

  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    if (!newAnn.title || !newAnn.content || !selectedEventId) return;
    try {
      await commsService.createAnnouncement({
        ...newAnn,
        event_id: Number(selectedEventId)
      });
      setShowAnnModal(false);
      setNewAnn({
        title: '',
        content: '',
        priority: 'General',
        author: 'Event Coordinator'
      });
      fetchData();
      if (onIncidentChange) onIncidentChange();
    } catch (err) {
      alert("Error broadcasting: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleCreateEscalation = async (e) => {
    e.preventDefault();
    if (!newEsc.title || !selectedEventId) return;
    try {
      await commsService.createEscalation({
        ...newEsc,
        event_id: Number(selectedEventId)
      });
      setShowEscModal(false);
      setNewEsc({
        zone: 'North Gate',
        title: '',
        description: '',
        severity: 'Medium',
        reported_by: 'Crowd Marshal'
      });
      fetchData();
      if (onIncidentChange) onIncidentChange();
    } catch (err) {
      alert("Error reporting incident: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleUpdateEscalationStatus = async (id, status) => {
    try {
      await commsService.updateEscalation(id, { status });
      fetchData();
      if (onIncidentChange) onIncidentChange();
    } catch (err) {
      alert("Error updating incident: " + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-400" />
            Announcements & Crowd Escalations
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Broadcast emergency alerts to staff and track crowd bottlenecks, medical assists, and safety escalations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAnnModal(true)}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-semibold rounded-xl border border-slate-700 flex items-center gap-1.5 transition-all"
          >
            <Megaphone className="w-4 h-4 text-indigo-400" />
            <span>Broadcast Alert</span>
          </button>
          <button
            onClick={() => setShowEscModal(true)}
            className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-lg shadow-rose-600/30 flex items-center gap-1.5 transition-all"
          >
            <Flame className="w-4 h-4" />
            <span>Report Incident</span>
          </button>
        </div>
      </div>

      {/* Main 2-Column Split: Escalations (left/primary) & Announcements (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Escalations Incident Center (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Flame className="w-4 h-4 text-rose-400" />
              Crowd Incidents & Escalation Queue ({escalations.filter(e => e.status !== 'Resolved').length} Active)
            </h3>
            <span className="text-xs text-slate-500 font-mono">
              Total Logged: {escalations.length}
            </span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-400 text-xs">Loading incident feed...</div>
          ) : escalations.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 text-slate-400 text-xs">
              No crowd incidents reported. All venue perimeters operating normally.
            </div>
          ) : (
            <div className="space-y-3">
              {escalations.map((esc) => {
                const isResolved = esc.status === 'Resolved';
                const isCritical = esc.severity === 'Critical';
                const isHigh = esc.severity === 'High';

                const severityBadge = isCritical
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                  : isHigh
                  ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40';

                return (
                  <div
                    key={esc.id}
                    className={`p-5 rounded-2xl border transition-all ${
                      isResolved
                        ? 'bg-slate-900/50 border-slate-800 opacity-60'
                        : isCritical
                        ? 'bg-rose-950/20 border-rose-500/40 shadow-lg shadow-rose-950/30'
                        : 'bg-slate-900/90 border-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${severityBadge}`}>
                            {esc.severity} Severity
                          </span>
                          <span className="inline-flex items-center gap-1 text-slate-400 text-xs">
                            <MapPin className="w-3 h-3 text-indigo-400" />
                            {esc.zone}
                          </span>
                          <span className="text-[11px] text-slate-500">#{esc.id}</span>
                        </div>
                        <h4 className="font-bold text-white text-sm sm:text-base">{esc.title}</h4>
                      </div>

                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap border ${
                          isResolved
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : esc.status === 'In Review'
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}
                      >
                        {esc.status}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 mt-2">{esc.description}</p>

                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-400">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-500" />
                          {esc.reported_by}
                        </span>
                        {esc.resolved_at && (
                          <span className="text-emerald-400 font-medium">
                            Resolved at {esc.resolved_at}
                          </span>
                        )}
                      </div>

                      {/* Status action buttons */}
                      {!isResolved ? (
                        <div className="flex items-center gap-1.5 self-end sm:self-auto">
                          {esc.status === 'Open' && (
                            <button
                              onClick={() => handleUpdateEscalationStatus(esc.id, 'In Review')}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 transition-colors"
                            >
                              Dispatch Review
                            </button>
                          )}
                          <button
                            onClick={() => handleUpdateEscalationStatus(esc.id, 'Resolved')}
                            className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white rounded-lg text-xs font-medium border border-emerald-500/30 transition-colors flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Mark Resolved</span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-emerald-500 text-xs font-medium flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5" /> Incident Closed
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Announcements Feed (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-indigo-400" />
              Broadcast Announcements ({announcements.length})
            </h3>
          </div>

          {announcements.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 text-slate-400 text-xs">
              No broadcast announcements issued yet.
            </div>
          ) : (
            <div className="space-y-3">
              {announcements.map((ann) => {
                const isCrit = ann.priority === 'Critical Alert';
                const isHigh = ann.priority === 'High';

                const borderStyle = isCrit
                  ? 'border-rose-500/40 bg-rose-950/20'
                  : isHigh
                  ? 'border-amber-500/30 bg-amber-950/10'
                  : 'border-slate-800 bg-slate-900/80';

                const priorityBadge = isCrit
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  : isHigh
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40';

                return (
                  <div
                    key={ann.id}
                    className={`p-4 rounded-xl border ${borderStyle} transition-all shadow-sm`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${priorityBadge}`}>
                        {ann.priority}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">#{ann.id}</span>
                    </div>

                    <h4 className="font-bold text-white text-sm">{ann.title}</h4>
                    <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">{ann.content}</p>

                    <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Sender: <strong className="text-slate-300">{ann.author}</strong></span>
                      <span className="text-slate-500">Live</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal: Broadcast Announcement */}
      {showAnnModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Broadcast Ground Announcement</h3>
            <form onSubmit={handleCreateAnnouncement} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Alert Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Weather Alert / Shift Rotation"
                  value={newAnn.title}
                  onChange={(e) => setNewAnn({ ...newAnn, title: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Message Content *</label>
                <textarea
                  rows="3"
                  required
                  placeholder="Detail instructions for volunteers and field coordinators..."
                  value={newAnn.content}
                  onChange={(e) => setNewAnn({ ...newAnn, content: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Priority</label>
                  <select
                    value={newAnn.priority}
                    onChange={(e) => setNewAnn({ ...newAnn, priority: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="General">General Info</option>
                    <option value="High">High Priority</option>
                    <option value="Critical Alert">Critical Alert</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Sender Tag</label>
                  <input
                    type="text"
                    value={newAnn.author}
                    onChange={(e) => setNewAnn({ ...newAnn, author: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAnnModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/30"
                >
                  Broadcast Now
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Report Escalation */}
      {showEscModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Report Crowd Incident</h3>
            <form onSubmit={handleCreateEscalation} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Incident Headline *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bottleneck at Main Gate Entry Barrier"
                  value={newEsc.title}
                  onChange={(e) => setNewEsc({ ...newEsc, title: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Situation Description</label>
                <textarea
                  rows="3"
                  placeholder="Describe severity, crowd density, resources needed..."
                  value={newEsc.description}
                  onChange={(e) => setNewEsc({ ...newEsc, description: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Location Zone</label>
                  <select
                    value={newEsc.zone}
                    onChange={(e) => setNewEsc({ ...newEsc, zone: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="North Gate">North Gate</option>
                    <option value="South Exit">South Exit</option>
                    <option value="Main Stage">Main Stage</option>
                    <option value="Medical Tent">Medical Tent</option>
                    <option value="Food Court">Food Court</option>
                    <option value="VIP Lounge">VIP Lounge</option>
                    <option value="General">General</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Severity</label>
                  <select
                    value={newEsc.severity}
                    onChange={(e) => setNewEsc({ ...newEsc, severity: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Reported By</label>
                <input
                  type="text"
                  value={newEsc.reported_by}
                  onChange={(e) => setNewEsc({ ...newEsc, reported_by: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEscModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 shadow-md shadow-rose-600/30"
                >
                  Submit Incident
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
