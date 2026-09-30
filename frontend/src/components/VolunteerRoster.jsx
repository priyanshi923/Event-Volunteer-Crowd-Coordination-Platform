import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Plus,
  UserCheck,
  LogOut,
  LogIn,
  Phone,
  Mail,
  ShieldAlert,
  Award,
  CheckCircle2,
  Clock,
  Calendar,
  History,
  X,
  Compass
} from 'lucide-react';
import { volunteerService } from '../services/api';

export default function VolunteerRoster({ onStatusChange }) {
  const [volunteers, setVolunteers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [selectedVolunteerHistory, setSelectedVolunteerHistory] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // New volunteer form
  const [newVol, setNewVol] = useState({
    full_name: '',
    email: '',
    phone: '',
    skills: 'Crowd Control, First Aid',
    emergency_contact: '',
    notes: '',
    preferences: 'North Gate'
  });

  const fetchVolunteers = async () => {
    try {
      setLoading(true);
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (statusFilter !== 'All') params.status = statusFilter;

      const res = await volunteerService.getVolunteers(params);
      setVolunteers(res.data);
    } catch (err) {
      console.error("Error fetching volunteers:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchVolunteers();
    }, 250);
    return () => clearTimeout(delayDebounce);
  }, [search, statusFilter]);

  const handleCheckIn = async (id) => {
    try {
      await volunteerService.checkIn(id);
      await fetchVolunteers();
      if (onStatusChange) onStatusChange();
    } catch (err) {
      alert(err.response?.data?.detail || err.message);
    }
  };

  const handleCheckOut = async (id) => {
    try {
      await volunteerService.checkOut(id);
      await fetchVolunteers();
      if (onStatusChange) onStatusChange();
    } catch (err) {
      alert(err.response?.data?.detail || err.message);
    }
  };

  const handleViewHistory = async (id) => {
    try {
      setLoadingHistory(true);
      const res = await volunteerService.getVolunteer(id);
      setSelectedVolunteerHistory(res.data);
    } catch (err) {
      alert("Failed loading attendance history: " + (err.response?.data?.detail || err.message));
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleCreateVolunteer = async (e) => {
    e.preventDefault();
    if (!newVol.full_name || !newVol.email) return;
    try {
      await volunteerService.createVolunteer(newVol);
      setShowModal(false);
      setNewVol({
        full_name: '',
        email: '',
        phone: '',
        skills: 'Crowd Control, First Aid',
        emergency_contact: '',
        notes: '',
        preferences: 'North Gate'
      });
      fetchVolunteers();
      if (onStatusChange) onStatusChange();
    } catch (err) {
      alert("Registration failed: " + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Registration CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" />
            Volunteer Profiles & Attendance Tracking
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time gate check-in/out, automatic session hours calculation, availability, and assigned shifts.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 self-start sm:self-auto transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Register Volunteer</span>
        </button>
      </div>

      {/* Search & Status Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        {/* Search Bar */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, skill (e.g. CPR), or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {['All', 'Checked In', 'Registered', 'Checked Out'].map((st) => {
            const active = statusFilter === st;
            return (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  active
                    ? 'bg-slate-700 text-white border border-slate-600'
                    : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {st}
              </button>
            );
          })}
        </div>
      </div>

      {/* Volunteer Grid */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 text-sm">Loading volunteer roster...</div>
      ) : volunteers.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 text-slate-400 text-sm">
          No volunteers match the current search filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {volunteers.map((vol) => {
            const isCheckedIn = (vol.current_status || vol.status) === 'Checked In';
            const isCheckedOut = (vol.current_status || vol.status) === 'Checked Out';
            const name = vol.name || vol.full_name;

            const statusBadgeBg = isCheckedIn
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : isCheckedOut
              ? 'bg-slate-700/50 text-slate-400 border-slate-700'
              : 'bg-blue-500/10 text-blue-400 border-blue-500/30';

            const skillsList = vol.skills ? vol.skills.split(',').map(s => s.trim()) : [];
            const assignedShifts = vol.current_assigned_shifts || [];

            return (
              <div
                key={vol.id}
                className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 transition-all flex flex-col justify-between shadow-md"
              >
                <div>
                  {/* Card Header: Avatar, Name, Status, and Total Hours */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-800 text-white font-bold text-sm flex items-center justify-center shadow-md shrink-0">
                        {name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-sm sm:text-base leading-tight">
                          {name}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[11px] text-slate-400">ID: #{vol.id}</span>
                          <span className="text-slate-600">•</span>
                          <span className={`text-[10px] font-semibold ${isCheckedIn ? 'text-emerald-400' : 'text-slate-400'}`}>
                            {vol.availability || (isCheckedOut ? 'Checked Out' : 'Available')}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusBadgeBg}`}>
                        {vol.current_status || vol.status}
                      </span>
                    </div>
                  </div>

                  {/* Total Hours Worked Badge */}
                  <div className="mt-3.5 flex items-center justify-between bg-slate-800/60 px-3 py-1.5 rounded-xl border border-slate-700/40 text-xs">
                    <div className="flex items-center gap-1.5 text-amber-300 font-semibold">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span>{vol.total_hours_worked ?? 0.0} hrs worked</span>
                    </div>
                    <button
                      onClick={() => handleViewHistory(vol.id)}
                      title="View full attendance session logs"
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium transition-colors"
                    >
                      <History className="w-3 h-3" />
                      <span>History</span>
                    </button>
                  </div>

                  {/* Contact Info */}
                  <div className="mt-3 space-y-1 text-xs text-slate-300">
                    <div className="flex items-center gap-2 text-slate-400">
                      <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">{vol.email}</span>
                    </div>
                    {vol.phone && (
                      <div className="flex items-center gap-2 text-slate-400">
                        <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>{vol.phone}</span>
                      </div>
                    )}
                    {vol.emergency_contact && (
                      <div className="flex items-center gap-2 text-rose-400/90 text-[11px]">
                        <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">ICE: {vol.emergency_contact}</span>
                      </div>
                    )}
                    {vol.preferences && (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                        <Compass className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span>Prefers: <strong className="text-slate-300">{vol.preferences}</strong></span>
                      </div>
                    )}
                  </div>

                  {/* Skills tags */}
                  <div className="mt-3">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                      Certified Skills
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {skillsList.map((skill, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-[11px] font-medium"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Assigned Shifts */}
                  <div className="mt-3 pt-2.5 border-t border-slate-800/80">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                      Assigned Shifts ({assignedShifts.length})
                    </span>
                    {assignedShifts.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {assignedShifts.map((s, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded bg-slate-800 text-indigo-300 text-[11px] border border-slate-700 font-medium"
                          >
                            {s.title} ({s.zone})
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-500 italic">No active shifts assigned</span>
                    )}
                  </div>

                  {/* Timestamps */}
                  {(vol.check_in_time || vol.check_out_time) && (
                    <div className="mt-3 pt-2.5 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-0.5">
                      {vol.check_in_time && (
                        <div className="flex items-center gap-1.5">
                          <LogIn className="w-3 h-3 text-emerald-400" />
                          <span>Last Check-In: {vol.check_in_time}</span>
                        </div>
                      )}
                      {vol.check_out_time && (
                        <div className="flex items-center gap-1.5">
                          <LogOut className="w-3 h-3 text-slate-400" />
                          <span>Last Check-Out: {vol.check_out_time}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Explicit Check In & Check Out Action Buttons */}
                <div className="mt-4 pt-3 border-t border-slate-800 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleCheckIn(vol.id)}
                    disabled={isCheckedIn}
                    title={isCheckedIn ? "Volunteer is already checked in" : "Record check-in timestamp"}
                    className={`py-2 px-3 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-all ${
                      isCheckedIn
                        ? 'bg-slate-800/50 text-slate-500 border border-slate-800 cursor-not-allowed'
                        : 'bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 shadow-md'
                    }`}
                  >
                    <LogIn className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{isCheckedIn ? 'Checked In' : 'Check In'}</span>
                  </button>

                  <button
                    onClick={() => handleCheckOut(vol.id)}
                    disabled={!isCheckedIn}
                    title={!isCheckedIn ? "Cannot check out unless currently checked in" : "Record check-out & calculate session hours"}
                    className={`py-2 px-3 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-all ${
                      !isCheckedIn
                        ? 'bg-slate-800/50 text-slate-500 border border-slate-800 cursor-not-allowed'
                        : 'bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 shadow-md'
                    }`}
                  >
                    <LogOut className="w-3.5 h-3.5 text-rose-400" />
                    <span>Check Out</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Volunteer Attendance History */}
      {selectedVolunteerHistory && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-start justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <History className="w-5 h-5 text-indigo-400" />
                  Attendance History: {selectedVolunteerHistory.name || selectedVolunteerHistory.full_name}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Total Accumulated Hours: <strong className="text-amber-400">{selectedVolunteerHistory.total_hours_worked} hrs</strong>
                </p>
              </div>
              <button
                onClick={() => setSelectedVolunteerHistory(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto my-4 space-y-2.5 pr-1">
              {(!selectedVolunteerHistory.attendance_history || selectedVolunteerHistory.attendance_history.length === 0) ? (
                <div className="p-8 text-center text-slate-500 text-xs italic">
                  No attendance session records logged for this volunteer yet.
                </div>
              ) : (
                selectedVolunteerHistory.attendance_history.map((record) => (
                  <div
                    key={record.id}
                    className="p-3.5 rounded-xl bg-slate-800/70 border border-slate-700/60 flex items-center justify-between text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-emerald-400">
                        <LogIn className="w-3.5 h-3.5" />
                        <span>In: <strong>{record.check_in_time}</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <LogOut className="w-3.5 h-3.5" />
                        <span>
                          Out: <strong>{record.check_out_time || 'Session In Progress'}</strong>
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="block text-[10px] uppercase text-slate-500 font-bold">Duration</span>
                      <span className="font-extrabold text-amber-300 text-sm">
                        {record.hours_worked > 0 ? `${record.hours_worked} hrs` : 'Active'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedVolunteerHistory(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Register Volunteer */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Register New Volunteer</h3>
            <form onSubmit={handleCreateVolunteer} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Maya Lin"
                  value={newVol.full_name}
                  onChange={(e) => setNewVol({ ...newVol, full_name: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. maya@example.com"
                  value={newVol.email}
                  onChange={(e) => setNewVol({ ...newVol, email: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="+1-555-0199"
                    value={newVol.phone}
                    onChange={(e) => setNewVol({ ...newVol, phone: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Zone Preference</label>
                  <input
                    type="text"
                    placeholder="e.g. North Gate"
                    value={newVol.preferences}
                    onChange={(e) => setNewVol({ ...newVol, preferences: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Skills & Certifications (Comma separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. First Aid, CPR, Crowd Control, Multilingual"
                  value={newVol.skills}
                  onChange={(e) => setNewVol({ ...newVol, skills: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Emergency Contact (ICE)
                </label>
                <input
                  type="text"
                  placeholder="Name & Relationship / Phone"
                  value={newVol.emergency_contact}
                  onChange={(e) => setNewVol({ ...newVol, emergency_contact: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/30"
                >
                  Register
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
