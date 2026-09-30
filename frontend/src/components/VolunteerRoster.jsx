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
  Clock
} from 'lucide-react';
import { volunteerService } from '../services/api';

export default function VolunteerRoster({ onStatusChange }) {
  const [volunteers, setVolunteers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);

  // New volunteer form
  const [newVol, setNewVol] = useState({
    full_name: '',
    email: '',
    phone: '',
    skills: 'Crowd Control, First Aid',
    emergency_contact: '',
    notes: ''
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
      alert("Check-in failed: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleCheckOut = async (id) => {
    try {
      await volunteerService.checkOut(id);
      await fetchVolunteers();
      if (onStatusChange) onStatusChange();
    } catch (err) {
      alert("Check-out failed: " + (err.response?.data?.detail || err.message));
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
        notes: ''
      });
      fetchVolunteers();
      if (onStatusChange) onStatusChange();
    } catch (err) {
      alert("Registration failed: " + (err.response?.data?.detail || err.message));
    }
  };

  const statusCounts = {
    all: volunteers.length,
    checkedIn: volunteers.filter(v => v.status === 'Checked In').length,
    registered: volunteers.filter(v => v.status === 'Registered').length,
    checkedOut: volunteers.filter(v => v.status === 'Checked Out').length,
  };

  return (
    <div className="space-y-6">
      {/* Header & Registration CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" />
            Volunteer Profiles & Gate Check-In
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage volunteer competencies, track on-site presence, and record check-in/out timestamps.
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {volunteers.map((vol) => {
            const isCheckedIn = vol.status === 'Checked In';
            const isCheckedOut = vol.status === 'Checked Out';

            const statusBadgeBg = isCheckedIn
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : isCheckedOut
              ? 'bg-slate-700/50 text-slate-400 border-slate-700'
              : 'bg-blue-500/10 text-blue-400 border-blue-500/30';

            const skillsList = vol.skills ? vol.skills.split(',').map(s => s.trim()) : [];

            return (
              <div
                key={vol.id}
                className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 transition-all flex flex-col justify-between shadow-md"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-800 text-white font-bold text-sm flex items-center justify-center shadow-md">
                        {vol.full_name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-sm sm:text-base leading-tight">
                          {vol.full_name}
                        </h3>
                        <span className="text-[11px] text-slate-400">ID: #{vol.id}</span>
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusBadgeBg}`}>
                      {vol.status}
                    </span>
                  </div>

                  {/* Contact Info */}
                  <div className="mt-3.5 space-y-1.5 text-xs text-slate-300">
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
                  </div>

                  {/* Skills tags */}
                  <div className="mt-3.5">
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

                  {/* Timestamps */}
                  {(vol.check_in_time || vol.check_out_time) && (
                    <div className="mt-3 pt-2.5 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-0.5">
                      {vol.check_in_time && (
                        <div className="flex items-center gap-1.5">
                          <LogIn className="w-3 h-3 text-emerald-400" />
                          <span>In: {vol.check_in_time}</span>
                        </div>
                      )}
                      {vol.check_out_time && (
                        <div className="flex items-center gap-1.5">
                          <LogOut className="w-3 h-3 text-slate-400" />
                          <span>Out: {vol.check_out_time}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Check In / Out Quick Action */}
                <div className="mt-4 pt-3 border-t border-slate-800">
                  {isCheckedIn ? (
                    <button
                      onClick={() => handleCheckOut(vol.id)}
                      className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-1.5 transition-all"
                    >
                      <LogOut className="w-3.5 h-3.5 text-rose-400" />
                      <span>Check Out</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleCheckIn(vol.id)}
                      className="w-full py-2 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white font-semibold text-xs rounded-xl border border-emerald-500/30 flex items-center justify-center gap-1.5 transition-all shadow-md"
                    >
                      <LogIn className="w-3.5 h-3.5 text-emerald-400 group-hover:text-white" />
                      <span>Check In to Venue</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
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
