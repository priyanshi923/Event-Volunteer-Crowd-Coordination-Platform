import React, { useState, useEffect } from 'react';
import {
  Clock,
  Plus,
  Users,
  Award,
  MapPin,
  Sparkles,
  UserCheck,
  X,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  UserMinus,
  Shuffle,
  Info,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { shiftService, eventService } from '../services/api';

export default function ShiftAssignment({
  selectedEventId,
  volunteers,
  onAssignmentChange
}) {
  const [shifts, setShifts] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [rebalancing, setRebalancing] = useState(false);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [selectedShiftForAssign, setSelectedShiftForAssign] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [rebalanceResult, setRebalanceResult] = useState(null);
  const [dropoutNotice, setDropoutNotice] = useState(null);

  // Form for new shift
  const [newShift, setNewShift] = useState({
    title: '',
    start_time: '09:00',
    end_time: '13:00',
    zone: 'North Gate',
    required_skill: 'Crowd Control',
    capacity: 2,
    role_id: null
  });

  const fetchShifts = async () => {
    if (!selectedEventId) return;
    try {
      setLoading(true);
      const [resShifts, resRoles] = await Promise.all([
        shiftService.getShifts(selectedEventId),
        eventService.getRoles(selectedEventId)
      ]);
      setShifts(resShifts.data);
      setRoles(resRoles.data);
    } catch (err) {
      console.error("Error fetching shifts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShifts();
  }, [selectedEventId]);

  const handleOpenAssignModal = async (shift, isReplacementMode = false) => {
    setSelectedShiftForAssign(shift);
    if (!isReplacementMode) {
      setDropoutNotice(null);
    }
    try {
      setLoadingRecs(true);
      const res = await shiftService.getRecommendations(shift.id);
      setRecommendations(res.data);
    } catch (err) {
      console.error("Error fetching recommendations:", err);
    } finally {
      setLoadingRecs(false);
    }
  };

  const handleAssign = async (shiftId, volunteerId) => {
    try {
      await shiftService.assignVolunteer(shiftId, volunteerId);
      await fetchShifts();
      if (selectedShiftForAssign) {
        const res = await shiftService.getRecommendations(shiftId);
        setRecommendations(res.data);
      }
      setDropoutNotice(null);
      if (onAssignmentChange) onAssignmentChange();
    } catch (err) {
      alert("Assignment failed: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleUnassign = async (assignmentId) => {
    try {
      await shiftService.unassignVolunteer(assignmentId);
      await fetchShifts();
      if (onAssignmentChange) onAssignmentChange();
    } catch (err) {
      alert("Unassign failed: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleVolunteerDropout = async (shift, volunteer) => {
    if (!confirm(`Mark ${volunteer.full_name} as dropped out from "${shift.title}"? They will be marked unavailable for this shift and replacement suggestions will be generated.`)) {
      return;
    }
    try {
      const res = await shiftService.dropout(shift.id, volunteer.id);
      await fetchShifts();
      if (onAssignmentChange) onAssignmentChange();

      // Open replacement suggestion modal with top 3 replacements
      setSelectedShiftForAssign(shift);
      setDropoutNotice({
        volunteerName: volunteer.full_name,
        shiftTitle: shift.title,
        message: res.data.message
      });
      if (res.data.replacements) {
        setRecommendations(res.data.replacements.map(s => ({
          id: s.volunteer_id,
          full_name: s.volunteer_name,
          skills: s.matched_skills?.join(', ') || 'General',
          status: s.availability,
          match_score: s.score,
          is_assigned: false,
          matching_skills: s.matched_skills,
          is_checked_in: s.availability.includes('Checked In'),
          conflict_status: s.conflict_status,
          current_workload: s.current_workload,
          reason: s.reason,
          score_breakdown: s.score_breakdown
        })));
      }
    } catch (err) {
      alert("Dropout failed: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleAutoAssignAll = async () => {
    try {
      setAutoAssigning(true);
      await shiftService.autoAssign({ event_id: selectedEventId });
      await fetchShifts();
      if (onAssignmentChange) onAssignmentChange();
    } catch (err) {
      alert("Auto-assign failed: " + (err.response?.data?.detail || err.message));
    } finally {
      setAutoAssigning(false);
    }
  };

  const handleAutoAssignSingle = async (shiftId) => {
    try {
      await shiftService.autoAssign({ shift_id: shiftId });
      await fetchShifts();
      if (onAssignmentChange) onAssignmentChange();
    } catch (err) {
      alert("Auto-assign shift failed: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleRebalanceStaffing = async () => {
    try {
      setRebalancing(true);
      const res = await shiftService.rebalance({ event_id: selectedEventId, apply: true });
      setRebalanceResult(res.data);
      await fetchShifts();
      if (onAssignmentChange) onAssignmentChange();
    } catch (err) {
      alert("Rebalance failed: " + (err.response?.data?.detail || err.message));
    } finally {
      setRebalancing(false);
    }
  };

  const handleCreateShift = async (e) => {
    e.preventDefault();
    if (!newShift.title || !selectedEventId) return;
    try {
      await shiftService.createShift({
        ...newShift,
        event_id: Number(selectedEventId),
        capacity: Number(newShift.capacity),
        role_id: newShift.role_id ? Number(newShift.role_id) : null
      });
      setShowShiftModal(false);
      setNewShift({
        title: '',
        start_time: '09:00',
        end_time: '13:00',
        zone: 'North Gate',
        required_skill: 'Crowd Control',
        capacity: 2,
        role_id: null
      });
      fetchShifts();
    } catch (err) {
      alert("Failed creating shift: " + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Controls & Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-800 gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-400" />
            Skill-Based Shift Assignment & Headcount Coverage
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            5-Weight Rule Engine: Skills (40), Availability (25), No Conflicts (20), Preferences (10), Workload Fairness (5).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleRebalanceStaffing}
            disabled={rebalancing || shifts.length === 0}
            title="Identify understaffed zones and rebalance surplus volunteers"
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs sm:text-sm font-semibold rounded-xl border border-slate-700 flex items-center gap-1.5 transition-all shadow-sm"
          >
            <Shuffle className={`w-4 h-4 text-amber-400 ${rebalancing ? 'animate-spin' : ''}`} />
            <span>{rebalancing ? 'Rebalancing...' : 'Rebalance Staff'}</span>
          </button>

          <button
            onClick={handleAutoAssignAll}
            disabled={autoAssigning || shifts.length === 0}
            className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all"
          >
            <Zap className={`w-4 h-4 ${autoAssigning ? 'animate-bounce' : ''}`} />
            <span>{autoAssigning ? 'Scoring & Assigning...' : 'Auto-Assign All Shifts'}</span>
          </button>

          <button
            onClick={() => setShowShiftModal(true)}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-semibold rounded-xl border border-slate-700 flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create Shift</span>
          </button>
        </div>
      </div>

      {/* Rebalance Toast/Notice Banner */}
      {rebalanceResult && (
        <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-500/30 flex items-center justify-between text-xs text-indigo-200">
          <div className="flex items-center gap-2">
            <Shuffle className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>
              Rebalance executed: {rebalanceResult.suggestions_count} staff reallocations applied to balance zone coverage.
            </span>
          </div>
          <button
            onClick={() => setRebalanceResult(null)}
            className="text-slate-400 hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Shifts Grid */}
      {loading ? (
        <div className="p-8 text-center text-slate-400 text-sm">Loading shifts...</div>
      ) : shifts.length === 0 ? (
        <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 text-slate-400 text-sm">
          No shifts scheduled for this event. Click "Create Shift" to add operational slots.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {shifts.map((shift) => {
            const activeAssignments = (shift.assignments || []).filter(
              a => a.status === 'Assigned' || a.status === 'Confirmed'
            );
            const reqCount = shift.coverage?.required_count || shift.capacity || 2;
            const asgnCount = shift.coverage?.assigned_count ?? activeAssignments.length;
            const covStatus = shift.coverage?.coverage_status || (asgnCount >= reqCount ? 'FULL' : asgnCount > 0 ? 'PARTIAL' : 'CRITICAL');
            const covPct = shift.coverage?.coverage_percentage ?? (reqCount > 0 ? Math.round((asgnCount / reqCount) * 100) : 100);
            const covGap = shift.coverage?.coverage_gap ?? Math.max(0, reqCount - asgnCount);

            const statusColors = {
              FULL: {
                badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
                bar: 'bg-emerald-500',
                dot: 'bg-emerald-400'
              },
              PARTIAL: {
                badge: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
                bar: 'bg-amber-500',
                dot: 'bg-amber-400'
              },
              CRITICAL: {
                badge: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
                bar: 'bg-rose-500',
                dot: 'bg-rose-400 animate-pulse'
              }
            }[covStatus] || {
              badge: 'bg-slate-700 text-slate-300 border-slate-600',
              bar: 'bg-slate-500',
              dot: 'bg-slate-400'
            };

            return (
              <div
                key={shift.id}
                className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 transition-all flex flex-col justify-between shadow-md"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">
                      {shift.start_time} - {shift.end_time}
                    </span>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusColors.badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusColors.dot}`} />
                      {covStatus} ({covPct}%)
                    </span>
                  </div>

                  <h3 className="font-bold text-white text-base mt-2.5">{shift.title}</h3>

                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className="inline-flex items-center gap-1 text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700/60">
                      <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                      {shift.zone}
                    </span>
                    <span className="inline-flex items-center gap-1 text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                      <Award className="w-3.5 h-3.5" />
                      {shift.required_skill || 'General'}
                    </span>
                  </div>

                  {/* Coverage Headcount Progress Bar */}
                  <div className="mt-3.5 pt-3 border-t border-slate-800/80">
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                      <span className="font-medium">Headcount Coverage:</span>
                      <span className="font-bold text-white">
                        {asgnCount} / {reqCount} Volunteers
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-1.5 rounded-full transition-all duration-500 ${statusColors.bar}`}
                        style={{ width: `${Math.min(100, covPct)}%` }}
                      />
                    </div>
                    {covGap > 0 && (
                      <span className="block mt-1 text-[11px] text-amber-400/90 font-medium">
                        ⚠️ Deficit: Need {covGap} more volunteer{covGap > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {/* Assigned Volunteers List with Dropout Trigger */}
                  <div className="mt-4 pt-3 border-t border-slate-800/80">
                    <span className="text-[11px] uppercase font-semibold text-slate-400 block mb-2">
                      Active Staff ({activeAssignments.length})
                    </span>

                    {activeAssignments.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">No volunteers actively assigned.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {activeAssignments.map((asgn) => (
                          <div
                            key={asgn.id}
                            className="flex items-center justify-between bg-slate-800/70 px-2.5 py-1.5 rounded-lg border border-slate-700/50 text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-400 flex items-center justify-center text-[10px] font-bold">
                                {asgn.volunteer?.full_name?.charAt(0) || 'V'}
                              </div>
                              <span className="text-slate-200 font-medium">
                                {asgn.volunteer?.full_name || `Volunteer #${asgn.volunteer_id}`}
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              {/* Dropout Trigger Button */}
                              {asgn.volunteer && (
                                <button
                                  onClick={() => handleVolunteerDropout(shift, asgn.volunteer)}
                                  title="Volunteer dropped out? Mark unavailable & get replacements"
                                  className="px-1.5 py-0.5 text-[10px] text-rose-400 hover:text-white hover:bg-rose-600/40 rounded transition-colors"
                                >
                                  Dropout
                                </button>
                              )}
                              <button
                                onClick={() => handleUnassign(asgn.id)}
                                title="Remove assignment"
                                className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions: Auto Assign & Smart Skill Match */}
                <div className="mt-5 pt-3 border-t border-slate-800 flex gap-2">
                  <button
                    onClick={() => handleAutoAssignSingle(shift.id)}
                    disabled={covStatus === 'FULL'}
                    title="Auto-fill open slots with highest scoring candidates"
                    className="flex-1 py-2 bg-indigo-600/20 hover:bg-indigo-600/40 disabled:opacity-40 text-indigo-300 hover:text-white font-medium text-xs rounded-xl border border-indigo-500/30 flex items-center justify-center gap-1 transition-all"
                  >
                    <Zap className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Auto-Assign</span>
                  </button>

                  <button
                    onClick={() => handleOpenAssignModal(shift)}
                    className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Candidates</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Rule-Based Volunteer Matching & Replacement */}
      {selectedShiftForAssign && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-xl w-full shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between pb-3 border-b border-slate-800">
              <div>
                <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20 mb-1">
                  <Sparkles className="w-3 h-3" />
                  5-Weighted Rule Scoring Engine
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white">
                  Eligible Candidates for: {selectedShiftForAssign.title}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Required Skill: <span className="text-amber-400 font-semibold">{selectedShiftForAssign.required_skill}</span> | Zone: {selectedShiftForAssign.zone}
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedShiftForAssign(null);
                  setDropoutNotice(null);
                }}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Dropout Notification alert in modal if triggered */}
            {dropoutNotice && (
              <div className="mt-3 p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <div>
                  <strong>{dropoutNotice.volunteerName}</strong> dropped out. Here are the top replacement suggestions:
                </div>
              </div>
            )}

            {/* Candidates List with Detailed Rule Scores */}
            <div className="overflow-y-auto my-4 space-y-3 pr-1">
              {loadingRecs ? (
                <div className="p-8 text-center text-slate-400 text-xs">Computing rule scores (skills, availability, conflicts, workload)...</div>
              ) : recommendations.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs">
                  No eligible candidates found. All volunteers either have conflicts, are unavailable, or lack certified skills.
                </div>
              ) : (
                recommendations.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-4 rounded-xl border bg-slate-800/70 border-slate-700/70 hover:border-indigo-500/50 transition-all flex flex-col justify-between gap-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">{rec.full_name}</span>
                          {rec.is_checked_in && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-semibold border border-emerald-500/30">
                              Checked In
                            </span>
                          )}
                          <span className="text-[11px] text-slate-400">
                            Workload: <strong>{rec.current_workload}h</strong>
                          </span>
                        </div>

                        <p className="text-xs text-slate-300 mt-1">
                          Skills: <span className="font-medium text-amber-300">{rec.skills || 'General'}</span>
                        </p>

                        {/* Explanation Reason String */}
                        {rec.reason && (
                          <p className="text-[11px] text-slate-400 mt-1 italic">
                            💡 {rec.reason}
                          </p>
                        )}
                      </div>

                      {/* Score badge & Assign button */}
                      <div className="text-right shrink-0">
                        <div className="flex items-baseline gap-1 justify-end">
                          <span className="text-lg font-extrabold text-indigo-400">{rec.match_score}</span>
                          <span className="text-[10px] text-slate-500 font-bold">/ 100 pts</span>
                        </div>

                        <button
                          onClick={() => handleAssign(selectedShiftForAssign.id, rec.id)}
                          className="mt-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-lg shadow-md shadow-indigo-600/30 transition-all flex items-center gap-1"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>{dropoutNotice ? 'Assign Replacement' : 'Assign'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Weighted Rule Breakdown Pills */}
                    {rec.score_breakdown && (
                      <div className="pt-2 border-t border-slate-700/40 flex flex-wrap gap-1.5 text-[10px]">
                        <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-700">
                          Skill: +{rec.score_breakdown.skill_match}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-700">
                          Avail: +{rec.score_breakdown.availability}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-700">
                          No Conflict: +{rec.score_breakdown.no_conflict}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-700">
                          Preference: +{rec.score_breakdown.preference}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-700">
                          Fairness: +{rec.score_breakdown.workload_fairness}
                        </span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => {
                  setSelectedShiftForAssign(null);
                  setDropoutNotice(null);
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create Shift */}
      {showShiftModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Create Operating Shift</h3>
            <form onSubmit={handleCreateShift} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Shift Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Afternoon Main Gate Entry Surge"
                  value={newShift.title}
                  onChange={(e) => setNewShift({ ...newShift, title: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Start Time</label>
                  <input
                    type="text"
                    placeholder="08:00"
                    value={newShift.start_time}
                    onChange={(e) => setNewShift({ ...newShift, start_time: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">End Time</label>
                  <input
                    type="text"
                    placeholder="12:00"
                    value={newShift.end_time}
                    onChange={(e) => setNewShift({ ...newShift, end_time: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Venue Zone</label>
                  <select
                    value={newShift.zone}
                    onChange={(e) => setNewShift({ ...newShift, zone: e.target.value })}
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
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Required Skill</label>
                  <select
                    value={newShift.required_skill}
                    onChange={(e) => setNewShift({ ...newShift, required_skill: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Crowd Control">Crowd Control</option>
                    <option value="First Aid">First Aid / CPR</option>
                    <option value="Customer Service">Customer Service</option>
                    <option value="VIP Handling">VIP Handling</option>
                    <option value="Logistics">Logistics</option>
                    <option value="Security">Security</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Capacity (Headcount)</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={newShift.capacity}
                  onChange={(e) => setNewShift({ ...newShift, capacity: Number(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowShiftModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/30"
                >
                  Save Shift
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
