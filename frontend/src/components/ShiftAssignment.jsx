import React, { useState, useEffect } from 'react';
import { Plus, X, ArrowRight } from 'lucide-react';
import { shiftService, eventService } from '../services/api';
import Modal from './Modal';
import { useZoneNames, useSkills } from '../services/useOptions';

const COVERAGE_TEXT = {
  OVERSTAFFED: 'text-violet-700',
  FULL: 'text-green-700',
  PARTIAL: 'text-orange-700',
  CRITICAL: 'text-red-700',
};

function emptyShift(date = '') {
  return {
    title: '',
    date,
    start_time: '',
    end_time: '',
    zone: '',
    required_skill: '',
    mandatory_skill: '',
    optional_skill: '',
    capacity: 2,
    role_id: null
  };
}

function ScoreBreakdown({ breakdown }) {
  if (!breakdown) return null;
  const parts = [
    ['Skill', breakdown.skill_match],
    ['Zone', breakdown.zone_priority],
    ['Fairness', breakdown.workload_fairness],
    ['Preference', breakdown.preference],
    ['Reliability', breakdown.reliability],
  ];
  return (
    <p className="text-[11px] text-neutral-600 mt-1">
      {parts.map(([label, v]) => `${label} ${v ?? 0}`).join(' · ')}
    </p>
  );
}

// One candidate in the recommendation / replacement lists
function CandidateRow({ name, score, skills, workload, availability, checkedIn, breakdown, actionLabel, onAction }) {
  const unavailable = availability && !availability.startsWith('Available');
  return (
    <li className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-[13px] text-slate-700">
          {name}
          {checkedIn && <span className="ml-2 text-xs text-green-700">Checked in</span>}
        </p>
        <p className="text-xs text-neutral-600 mt-0.5 truncate">
          {skills || 'No listed skills'} · {workload}h workload
        </p>
        {unavailable && <p className="text-xs text-orange-700 mt-0.5">{availability}</p>}
        <ScoreBreakdown breakdown={breakdown} />
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-[13px] font-medium text-slate-700 tabular-nums" title="Assignment score out of 100">{score}</span>
        <button onClick={onAction} className="btn btn-secondary btn-sm">{actionLabel}</button>
      </div>
    </li>
  );
}

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
  const [replacementModalData, setReplacementModalData] = useState(null);
  const [showRebalanceModal, setShowRebalanceModal] = useState(false);
  const [rebalancePlan, setRebalancePlan] = useState(null);
  const [acceptingRebalanceId, setAcceptingRebalanceId] = useState(null);
  const [checkingNoShows, setCheckingNoShows] = useState(false);
  const [noShowNotice, setNoShowNotice] = useState(null);

  // Form for new shift
  const [newShift, setNewShift] = useState(emptyShift());
  const zoneOptions = useZoneNames(selectedEventId);
  const skillOptions = useSkills();

  const openShiftModal = () => {
    // Default the date to the event's existing shifts, otherwise today
    setNewShift(emptyShift(shifts[0]?.date || new Date().toISOString().slice(0, 10)));
    setShowShiftModal(true);
  };

  const handleRoleChange = (roleId) => {
    const role = roles.find((r) => String(r.id) === String(roleId));
    setNewShift((s) => ({
      ...s,
      role_id: roleId || null,
      // A role's required skill is the natural default for its shifts
      required_skill: role && !s.required_skill ? role.required_skill || '' : s.required_skill,
    }));
  };

  const handleCheckNoShows = async () => {
    try {
      setCheckingNoShows(true);
      const res = await shiftService.checkNoShows();
      await fetchShifts();
      const count = res.data?.no_shows_detected_count || 0;
      setNoShowNotice(count > 0 ? `Detected ${count} automatic no-show(s). System generated replacement suggestions and coordinator notifications.` : 'No-show check complete: All scheduled assignments are compliant with attendance windows.');
      if (onAssignmentChange) onAssignmentChange();
    } catch (err) {
      alert("No-show check error: " + (err.response?.data?.detail || err.message));
    } finally {
      setCheckingNoShows(false);
    }
  };

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

  const handleAssignReplacement = async (shiftId, volunteerId) => {
    try {
      await shiftService.assignVolunteer(shiftId, volunteerId);
      await fetchShifts();
      if (onAssignmentChange) onAssignmentChange();
      setReplacementModalData(null);
    } catch (err) {
      alert("Replacement assignment failed: " + (err.response?.data?.detail || err.message));
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

      const data = res.data;
      const suggestions = data.replacement_suggestions || data.replacements || [];
      setReplacementModalData({
        shift: data.affected_shift || shift,
        droppedVolunteer: volunteer,
        required_headcount: data.required_headcount,
        current_assigned_headcount: data.current_assigned_headcount,
        coverage_percentage: data.coverage_percentage,
        coverage_gap: data.coverage_gap,
        coverage_status: data.coverage_status,
        replacements: suggestions
      });
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

  const handleOpenRebalanceModal = async () => {
    try {
      setRebalancing(true);
      const res = await shiftService.rebalance({ event_id: selectedEventId, apply: false });
      setRebalancePlan(res.data);
      setShowRebalanceModal(true);
    } catch (err) {
      alert("Rebalance analysis failed: " + (err.response?.data?.detail || err.message));
    } finally {
      setRebalancing(false);
    }
  };

  const handleAcceptSingleRebalance = async (suggestion) => {
    try {
      setAcceptingRebalanceId(suggestion.volunteer_id);
      await shiftService.acceptRebalance({
        volunteer_id: suggestion.volunteer_id,
        source_shift_id: suggestion.source_shift_id,
        target_shift_id: suggestion.target_shift_id
      });
      await fetchShifts();
      if (onAssignmentChange) onAssignmentChange();

      // Refresh rebalance plan
      const res = await shiftService.rebalance({ event_id: selectedEventId, apply: false });
      setRebalancePlan(res.data);
      if ((res.data.suggestions || []).length === 0) {
        setRebalanceResult(res.data);
      }
    } catch (err) {
      alert("Accept rebalance failed: " + (err.response?.data?.detail || err.message));
    } finally {
      setAcceptingRebalanceId(null);
    }
  };

  const handleAcceptAllRebalances = async () => {
    try {
      setRebalancing(true);
      const res = await shiftService.rebalance({ event_id: selectedEventId, apply: true });
      setRebalanceResult(res.data);
      setShowRebalanceModal(false);
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
      setNewShift(emptyShift());
      fetchShifts();
      if (onAssignmentChange) onAssignmentChange();
    } catch (err) {
      alert("Failed creating shift: " + (err.response?.data?.detail || err.message));
    }
  };

  const totalOpen = shifts.reduce((sum, s) => sum + (s.coverage?.coverage_gap || 0), 0);

  const closeCandidates = () => {
    setSelectedShiftForAssign(null);
    setDropoutNotice(null);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Shifts</h1>
          <p className="page-subtitle">
            {shifts.length} shifts{totalOpen > 0 ? ` · ${totalOpen} open positions` : ' · fully staffed'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleCheckNoShows}
            disabled={checkingNoShows}
            title="Flag assigned volunteers who haven't checked in 15 minutes after shift start"
            className="btn btn-secondary"
          >
            {checkingNoShows ? 'Checking…' : 'Check no-shows'}
          </button>
          <button
            onClick={handleOpenRebalanceModal}
            disabled={rebalancing || shifts.length === 0}
            title="Move surplus volunteers from overstaffed shifts to understaffed ones"
            className="btn btn-secondary"
          >
            {rebalancing ? 'Analyzing…' : 'Rebalance'}
          </button>
          <button onClick={openShiftModal} disabled={!selectedEventId} className="btn btn-secondary">
            <Plus className="w-4 h-4" /> New shift
          </button>
          <button
            onClick={handleAutoAssignAll}
            disabled={autoAssigning || shifts.length === 0}
            title="Fill open positions, hardest-to-staff shifts first"
            className="btn btn-primary"
          >
            {autoAssigning ? 'Assigning…' : 'Auto-assign all'}
          </button>
        </div>
      </div>

      {(noShowNotice || rebalanceResult) && (
        <div className="mb-6 space-y-2">
          {noShowNotice && (
            <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-white/80 px-3 py-2 text-[13px] text-neutral-800">
              <span>{noShowNotice}</span>
              <button onClick={() => setNoShowNotice(null)} className="text-neutral-600 hover:text-slate-700" title="Dismiss">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          {rebalanceResult && (
            <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-white/80 px-3 py-2 text-[13px] text-neutral-800">
              <span>Staffing rebalanced.</span>
              <button onClick={() => setRebalanceResult(null)} className="text-neutral-600 hover:text-slate-700" title="Dismiss">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {loading && shifts.length === 0 ? (
        <div className="empty">Loading shifts…</div>
      ) : shifts.length === 0 ? (
        <div className="empty">No shifts yet. Create one to start staffing.</div>
      ) : (
        <ul className="panel divide-rows">
          {shifts.map((shift) => {
            const activeAssignments = (shift.assignments || []).filter(
              a => a.status === 'Assigned' || a.status === 'Confirmed' || a.status === 'Checked In'
            );
            const reqCount = shift.coverage?.required_count || shift.capacity || 2;
            const asgnCount = shift.coverage?.assigned_count ?? activeAssignments.length;
            const isOverstaffed = asgnCount > reqCount;
            const covStatus = isOverstaffed ? 'OVERSTAFFED' : (shift.coverage?.coverage_status || (asgnCount >= reqCount ? 'FULL' : asgnCount > 0 ? 'PARTIAL' : 'CRITICAL'));

            return (
              <li key={shift.id} className="px-4 py-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-slate-700">{shift.title}</p>
                    <p className="text-xs text-neutral-600 mt-0.5">
                      <span className="tabular-nums">{shift.start_time}–{shift.end_time}</span>
                      {' · '}{shift.zone}
                      {' · '}{shift.required_skill || 'General'}
                      {shift.mandatory_skill && <> · requires {shift.mandatory_skill}</>}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[13px] tabular-nums mr-1 ${COVERAGE_TEXT[covStatus] || 'text-neutral-700'}`}>
                      {asgnCount} of {reqCount} staffed
                    </span>
                    <button
                      onClick={() => handleAutoAssignSingle(shift.id)}
                      disabled={covStatus === 'FULL' || covStatus === 'OVERSTAFFED'}
                      title="Fill open positions with the highest-scoring eligible volunteers"
                      className="btn btn-ghost btn-sm"
                    >
                      Auto-fill
                    </button>
                    <button onClick={() => handleOpenAssignModal(shift)} className="btn btn-secondary btn-sm">
                      Candidates
                    </button>
                  </div>
                </div>

                {activeAssignments.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-1.5">
                    {activeAssignments.map((asgn) => (
                      <li
                        key={asgn.id}
                        className="inline-flex items-center gap-1 rounded-xl bg-brand-blue border-2 border-white/80 pl-2 pr-0.5 h-8 text-xs font-bold shadow-brutal-sm"
                      >
                        {asgn.status === 'Checked In' && <span className="dot bg-brand-green mr-0.5" title="Checked in" />}
                        {asgn.volunteer?.full_name || `Volunteer #${asgn.volunteer_id}`}
                        {asgn.volunteer && (
                          <button
                            onClick={() => handleVolunteerDropout(shift, asgn.volunteer)}
                            title="Mark as dropped out and get replacement suggestions"
                            className="ml-1 px-1.5 h-6 rounded text-[11px] font-bold underline underline-offset-2 hover:bg-brand-red"
                          >
                            Drop out
                          </button>
                        )}
                        <button
                          onClick={() => handleUnassign(asgn.id)}
                          title="Remove from shift"
                          className="w-6 h-6 inline-flex items-center justify-center rounded hover:bg-white"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Candidates for a shift */}
      {selectedShiftForAssign && (
        <Modal
          size="lg"
          title={selectedShiftForAssign.title}
          subtitle={`${selectedShiftForAssign.zone} · ${selectedShiftForAssign.required_skill || 'General'} · candidates ranked by score (out of 100)`}
          onClose={closeCandidates}
        >
          {dropoutNotice && (
            <p className="text-[13px] text-red-700 mb-2">
              {dropoutNotice.volunteerName} dropped out. Suggested replacements:
            </p>
          )}
          {loadingRecs ? (
            <div className="empty">Scoring volunteers…</div>
          ) : recommendations.length === 0 ? (
            <div className="empty">No eligible volunteers for this shift.</div>
          ) : (
            <ul className="divide-rows">
              {recommendations.map((rec) => (
                <CandidateRow
                  key={rec.id}
                  name={rec.full_name}
                  score={rec.match_score}
                  skills={rec.skills}
                  workload={rec.current_workload}
                  availability={rec.status}
                  checkedIn={rec.is_checked_in}
                  breakdown={rec.score_breakdown}
                  actionLabel="Assign"
                  onAction={() => handleAssign(selectedShiftForAssign.id, rec.id)}
                />
              ))}
            </ul>
          )}
        </Modal>
      )}

      {/* Replacement after a dropout */}
      {replacementModalData && (
        <Modal
          size="lg"
          title={`Replace ${replacementModalData.droppedVolunteer?.full_name || 'volunteer'}`}
          subtitle={`${replacementModalData.shift?.title} · now ${replacementModalData.current_assigned_headcount} of ${replacementModalData.required_headcount} staffed`}
          onClose={() => setReplacementModalData(null)}
        >
          {!replacementModalData.replacements || replacementModalData.replacements.length === 0 ? (
            <div className="empty">No replacement candidates available. Try rebalancing from overstaffed shifts.</div>
          ) : (
            <ul className="divide-rows">
              {replacementModalData.replacements.map((cand) => (
                <CandidateRow
                  key={cand.volunteer_id}
                  name={cand.volunteer_name}
                  score={cand.score}
                  skills={Array.isArray(cand.skills) ? cand.skills.join(', ') : cand.skills}
                  workload={cand.current_workload}
                  availability={cand.availability}
                  breakdown={cand.score_breakdown}
                  actionLabel="Assign"
                  onAction={() => handleAssignReplacement(replacementModalData.shift.id, cand.volunteer_id)}
                />
              ))}
            </ul>
          )}
        </Modal>
      )}

      {/* Rebalance suggestions */}
      {showRebalanceModal && (
        <Modal
          size="lg"
          title="Rebalance staffing"
          subtitle="Move surplus volunteers from overstaffed shifts to shifts with open positions."
          onClose={() => setShowRebalanceModal(false)}
          footer={
            rebalancePlan?.suggestions?.length > 0 && (
              <button onClick={handleAcceptAllRebalances} disabled={rebalancing} className="btn btn-primary">
                Apply suggested moves
              </button>
            )
          }
        >
          {(!rebalancePlan?.suggestions || rebalancePlan.suggestions.length === 0) ? (
            <div className="empty">
              <p>Nothing to move. No overstaffed shift has an eligible volunteer to spare.</p>
              {(rebalancePlan?.understaffed_zones || []).length > 0 && (
                <p className="mt-1">Understaffed zones: {rebalancePlan.understaffed_zones.join(', ')}</p>
              )}
            </div>
          ) : (
            <ul className="divide-rows">
              {rebalancePlan.suggestions.map((s, idx) => (
                <li key={idx} className="flex items-start justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[13px] text-slate-700">{s.volunteer_name}</p>
                    <p className="text-xs text-neutral-700 mt-0.5 flex items-center gap-1.5 flex-wrap">
                      {s.source_shift_title} <span className="text-neutral-500">({s.source_zone})</span>
                      <ArrowRight className="w-3 h-3 text-neutral-500" />
                      {s.target_shift_title} <span className="text-neutral-500">({s.target_zone})</span>
                    </p>
                    {s.expected_coverage_improvement && (
                      <p className="text-[11px] text-neutral-600 mt-1">{s.expected_coverage_improvement}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleAcceptSingleRebalance(s)}
                    disabled={acceptingRebalanceId === s.volunteer_id}
                    className="btn btn-secondary btn-sm shrink-0"
                  >
                    {acceptingRebalanceId === s.volunteer_id ? 'Moving…' : 'Move'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}

      {/* Create shift */}
      {showShiftModal && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3 className="modal-title mb-4">New shift</h3>
            <form onSubmit={handleCreateShift} className="space-y-4">
              <div>
                <label className="label">Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Afternoon main gate entry"
                  value={newShift.title}
                  onChange={(e) => setNewShift({ ...newShift, title: e.target.value })}
                  className="input"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">Date</label>
                  <input
                    type="date"
                    required
                    value={newShift.date}
                    onChange={(e) => setNewShift({ ...newShift, date: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Start</label>
                  <input
                    type="time"
                    required
                    value={newShift.start_time}
                    onChange={(e) => setNewShift({ ...newShift, start_time: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">End</label>
                  <input
                    type="time"
                    required
                    value={newShift.end_time}
                    onChange={(e) => setNewShift({ ...newShift, end_time: e.target.value })}
                    className="input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Zone</label>
                  <input
                    type="text"
                    list="shift-zone-options"
                    value={newShift.zone}
                    onChange={(e) => setNewShift({ ...newShift, zone: e.target.value })}
                    placeholder={zoneOptions.length ? 'Choose or type a zone' : 'e.g. Main entrance'}
                    className="input"
                  />
                  <datalist id="shift-zone-options">
                    {zoneOptions.map((z) => <option key={z} value={z} />)}
                  </datalist>
                </div>
                <div>
                  <label className="label">Role</label>
                  <select
                    value={newShift.role_id || ''}
                    onChange={(e) => handleRoleChange(e.target.value)}
                    className="input"
                  >
                    <option value="">{roles.length ? 'No role' : 'No roles defined'}</option>
                    {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Required skill</label>
                  <input
                    type="text"
                    list="shift-skill-options"
                    value={newShift.required_skill}
                    onChange={(e) => setNewShift({ ...newShift, required_skill: e.target.value })}
                    className="input"
                  />
                  <datalist id="shift-skill-options">
                    {skillOptions.map((s) => <option key={s} value={s} />)}
                  </datalist>
                </div>
                <div>
                  <label className="label">Must have <span className="text-neutral-500">(optional)</span></label>
                  <input
                    type="text"
                    list="shift-skill-options"
                    value={newShift.mandatory_skill}
                    onChange={(e) => setNewShift({ ...newShift, mandatory_skill: e.target.value })}
                    title="Volunteers without this skill are never assigned"
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label className="label">Volunteers needed</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={newShift.capacity}
                  onChange={(e) => setNewShift({ ...newShift, capacity: Number(e.target.value) })}
                  className="input"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowShiftModal(false)} className="btn btn-ghost">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">Create shift</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
