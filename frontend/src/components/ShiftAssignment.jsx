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
  Trash2
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
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [selectedShiftForAssign, setSelectedShiftForAssign] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [loadingRecs, setLoadingRecs] = useState(false);

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

  const handleOpenAssignModal = async (shift) => {
    setSelectedShiftForAssign(shift);
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
        // Refresh recommendations list
        const res = await shiftService.getRecommendations(shiftId);
        setRecommendations(res.data);
      }
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
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-400" />
            Skill-Based Shift Assignment
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Algorithmically match volunteers to shifts based on certified skills, check-in status, and capacity.
          </p>
        </div>

        <button
          onClick={() => setShowShiftModal(true)}
          className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 self-start sm:self-auto transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Create Shift</span>
        </button>
      </div>

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
            const isFull = shift.assignments?.length >= shift.capacity;
            const openSpots = Math.max(0, shift.capacity - (shift.assignments?.length || 0));

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
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                        isFull
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}
                    >
                      {isFull ? 'Fully Staffed' : `${openSpots} Spot${openSpots > 1 ? 's' : ''} Open`}
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

                  {/* Assigned Volunteers List */}
                  <div className="mt-4 pt-3 border-t border-slate-800/80">
                    <span className="text-[11px] uppercase font-semibold text-slate-400 block mb-2">
                      Assigned Personnel ({shift.assignments?.length || 0}/{shift.capacity})
                    </span>

                    {shift.assignments?.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No volunteers assigned yet.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {shift.assignments.map((asgn) => (
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
                            <button
                              onClick={() => handleUnassign(asgn.id)}
                              title="Remove assignment"
                              className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Action */}
                <div className="mt-5 pt-3 border-t border-slate-800">
                  <button
                    onClick={() => handleOpenAssignModal(shift)}
                    className="w-full py-2 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 hover:text-white font-medium text-xs rounded-xl border border-indigo-500/30 flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Skill Match & Assign</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Smart Skill Match & Assign */}
      {selectedShiftForAssign && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-xl w-full shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between pb-3 border-b border-slate-800">
              <div>
                <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20 mb-1">
                  <Sparkles className="w-3 h-3" />
                  Algorithm Matching Engine
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white">
                  Match Volunteers for: {selectedShiftForAssign.title}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Required Skill: <span className="text-amber-400 font-semibold">{selectedShiftForAssign.required_skill}</span> | Zone: {selectedShiftForAssign.zone}
                </p>
              </div>
              <button
                onClick={() => setSelectedShiftForAssign(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Recommendations List */}
            <div className="overflow-y-auto my-4 space-y-2.5 pr-1">
              {loadingRecs ? (
                <div className="p-8 text-center text-slate-400 text-xs">Computing match scores...</div>
              ) : recommendations.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs">No volunteers found in system.</div>
              ) : (
                recommendations.map((rec) => (
                  <div
                    key={rec.id}
                    className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                      rec.is_assigned
                        ? 'bg-slate-800/40 border-slate-700/40 opacity-70'
                        : rec.match_score >= 10
                        ? 'bg-indigo-950/30 border-indigo-500/40 hover:border-indigo-500'
                        : 'bg-slate-800/60 border-slate-700/60'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-sm">{rec.full_name}</span>
                        {rec.is_checked_in && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-medium border border-emerald-500/30">
                            Checked In
                          </span>
                        )}
                        {rec.is_assigned && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 text-[10px] font-medium">
                            Already Assigned
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1 mt-1 text-[11px] text-slate-400">
                        <span>Skills:</span>
                        <span className="text-slate-300 font-medium">{rec.skills || 'None'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <span className="block text-[10px] uppercase font-semibold text-slate-400">Match</span>
                        <span
                          className={`text-xs font-bold ${
                            rec.match_score >= 10 ? 'text-indigo-400' : 'text-slate-400'
                          }`}
                        >
                          {rec.match_score > 0 ? `${rec.match_score * 8}%` : 'Low'}
                        </span>
                      </div>

                      {!rec.is_assigned ? (
                        <button
                          onClick={() => handleAssign(selectedShiftForAssign.id, rec.id)}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-lg shadow-md shadow-indigo-600/30 transition-all flex items-center gap-1"
                        >
                          <span>Assign</span>
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500 font-medium px-2">Assigned</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedShiftForAssign(null)}
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
