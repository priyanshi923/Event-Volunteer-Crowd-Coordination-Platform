import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { volunteerService } from '../services/api';
import Modal from './Modal';

const STATUS_DOT = {
  'Checked In': 'bg-brand-green',
  'Checked Out': 'bg-neutral-300',
};

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function Detail({ label, children }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-[13px]">
      <span className="text-neutral-600">{label}</span>
      <span className="text-slate-700 text-right">{children}</span>
    </div>
  );
}

export default function VolunteerRoster({ onStatusChange }) {
  const [volunteers, setVolunteers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedVolunteerHistory, setSelectedVolunteerHistory] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [availModalVolunteer, setAvailModalVolunteer] = useState(null);
  const [newSlot, setNewSlot] = useState({ day_of_week: 'Monday', start_time: '09:00', end_time: '13:00' });
  const [slotError, setSlotError] = useState('');

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

  const handleOpenAvailability = (vol) => {
    setAvailModalVolunteer(vol);
    setSlotError('');
    setNewSlot({ day_of_week: 'Monday', start_time: '09:00', end_time: '13:00' });
  };

  const handleAddAvailabilitySlot = async (e) => {
    e.preventDefault();
    if (!availModalVolunteer) return;
    setSlotError('');
    try {
      await volunteerService.addAvailability(availModalVolunteer.id, newSlot);
      const updatedVol = await volunteerService.getVolunteer(availModalVolunteer.id);
      setAvailModalVolunteer(updatedVol.data);
      fetchVolunteers();
    } catch (err) {
      setSlotError(err.response?.data?.detail || err.message);
    }
  };

  const handleDeleteAvailabilitySlot = async (slotId) => {
    if (!availModalVolunteer) return;
    try {
      await volunteerService.deleteAvailability(slotId);
      const updatedVol = await volunteerService.getVolunteer(availModalVolunteer.id);
      setAvailModalVolunteer(updatedVol.data);
      fetchVolunteers();
    } catch (err) {
      alert("Failed to delete slot: " + (err.response?.data?.detail || err.message));
    }
  };

  const profile = selectedVolunteerHistory;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Volunteers</h1>
          <p className="page-subtitle">Attendance, assigned shifts and availability.</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between mb-4">
        <div className="relative w-full sm:max-w-xs">
          <Search className="w-4 h-4 text-neutral-600 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search name, skill or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input input-sm pl-8"
          />
        </div>
        <div className="segmented self-start overflow-x-auto max-w-full">
          {['All', 'Available', 'Checked In', 'Checked Out'].map((st) => (
            <button key={st} aria-pressed={statusFilter === st} onClick={() => setStatusFilter(st)}>
              {st}
            </button>
          ))}
        </div>
      </div>

      {loading && volunteers.length === 0 ? (
        <div className="empty">Loading volunteers…</div>
      ) : volunteers.length === 0 ? (
        <div className="empty">No volunteers match this search.</div>
      ) : (
        <ul className="panel divide-rows">
          {volunteers.map((vol) => {
            const status = vol.current_status || vol.status;
            const isCheckedIn = status === 'Checked In';
            const name = vol.name || vol.full_name;
            const assignedShifts = vol.current_assigned_shifts || [];

            return (
              <li key={vol.id} className="px-4 py-3 flex flex-col md:flex-row md:items-center gap-3 md:gap-6">
                <button onClick={() => handleViewHistory(vol.id)} disabled={loadingHistory} className="min-w-0 md:w-64 text-left group">
                  <p className="text-[13px] text-slate-700 group-hover:underline underline-offset-2 truncate">{name}</p>
                  <p className="text-xs text-neutral-600 truncate mt-0.5">{vol.skills || 'No listed skills'}</p>
                </button>

                <div className="flex items-center gap-2 text-xs text-neutral-700 md:w-28 shrink-0">
                  <span className={`dot ${STATUS_DOT[status] || 'bg-brand-blue'}`} />
                  {status}
                </div>

                <p className="text-xs text-neutral-700 flex-1 min-w-0 truncate">
                  {assignedShifts.length > 0
                    ? assignedShifts.map((s) => s.title).join(', ')
                    : <span className="text-neutral-500">No shifts</span>}
                </p>

                <p className="text-xs text-neutral-600 tabular-nums md:w-16 md:text-right shrink-0">
                  {vol.total_hours_worked ?? 0}h
                </p>

                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => handleOpenAvailability(vol)} className="btn btn-ghost btn-sm">
                    Availability
                  </button>
                  {isCheckedIn ? (
                    <button
                      onClick={() => handleCheckOut(vol.id)}
                      title="Record check-out and session hours"
                      className="btn btn-secondary btn-sm w-24"
                    >
                      Check out
                    </button>
                  ) : (
                    <button
                      onClick={() => handleCheckIn(vol.id)}
                      title="Record check-in time"
                      className="btn btn-secondary btn-sm w-24"
                    >
                      Check in
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Profile & attendance history */}
      {profile && (
        <Modal
          title={profile.name || profile.full_name}
          subtitle={profile.skills}
          onClose={() => setSelectedVolunteerHistory(null)}
        >
          <div className="divide-rows">
            <Detail label="Status">{profile.current_status || profile.status}</Detail>
            <Detail label="Email">{profile.email}</Detail>
            {profile.phone && <Detail label="Phone">{profile.phone}</Detail>}
            {profile.emergency_contact && <Detail label="Emergency contact">{profile.emergency_contact}</Detail>}
            {profile.preferences && <Detail label="Prefers">{profile.preferences}</Detail>}
            <Detail label="Hours worked">{profile.total_hours_worked ?? 0}h</Detail>
            <Detail label="Reliability">
              {profile.reliability_score ?? '—'} / 10
              <span className="text-neutral-600"> · {profile.completed_shifts ?? 0} completed, {profile.no_shows ?? 0} no-shows, {profile.dropouts ?? 0} dropouts</span>
            </Detail>
          </div>

          <h4 className="section-title mt-6 mb-1">Attendance</h4>
          {(!profile.attendance_history || profile.attendance_history.length === 0) ? (
            <p className="text-[13px] text-neutral-600 py-2">No check-ins recorded yet.</p>
          ) : (
            <ul className="divide-rows">
              {profile.attendance_history.map((record) => (
                <li key={record.id} className="flex justify-between gap-4 py-2 text-[13px]">
                  <span className="text-neutral-800 tabular-nums">
                    {record.check_in_time} <span className="text-neutral-500">→</span> {record.check_out_time || 'now'}
                  </span>
                  <span className="text-neutral-600 tabular-nums">
                    {record.hours_worked > 0 ? `${record.hours_worked}h` : 'Active'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}

      {/* Availability slots */}
      {availModalVolunteer && (
        <Modal
          title="Availability"
          subtitle={`${availModalVolunteer.full_name || availModalVolunteer.name} · weekly hours they can be scheduled`}
          onClose={() => setAvailModalVolunteer(null)}
        >
          {(!availModalVolunteer.availability_slots || availModalVolunteer.availability_slots.length === 0) ? (
            <p className="text-[13px] text-neutral-600 pb-2">No slots declared — available for any shift without a conflict.</p>
          ) : (
            <ul className="divide-rows mb-2">
              {availModalVolunteer.availability_slots.map((slot) => (
                <li key={slot.id} className="flex items-center justify-between py-2 text-[13px]">
                  <span className="text-slate-700">
                    {slot.day_of_week} <span className="text-neutral-600 tabular-nums ml-1">{slot.start_time}–{slot.end_time}</span>
                  </span>
                  <button onClick={() => handleDeleteAvailabilitySlot(slot.id)} className="btn btn-danger btn-sm">
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={handleAddAvailabilitySlot} className="mt-4 pt-4 border-t-2 border-white/60">
            {slotError && <p className="text-xs text-red-700 mb-2">{slotError}</p>}
            <div className="grid grid-cols-[1fr_auto_auto] sm:grid-cols-[1fr_6.5rem_6.5rem_auto] gap-2 items-end">
              <div className="col-span-3 sm:col-span-1">
                <label className="label">Day</label>
                <select
                  value={newSlot.day_of_week}
                  onChange={(e) => setNewSlot({ ...newSlot, day_of_week: e.target.value })}
                  className="input input-sm"
                >
                  {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="label">From</label>
                <input
                  type="time"
                  required
                  value={newSlot.start_time}
                  onChange={(e) => setNewSlot({ ...newSlot, start_time: e.target.value })}
                  className="input input-sm"
                />
              </div>
              <div>
                <label className="label">To</label>
                <input
                  type="time"
                  required
                  value={newSlot.end_time}
                  onChange={(e) => setNewSlot({ ...newSlot, end_time: e.target.value })}
                  className="input input-sm"
                />
              </div>
              <button type="submit" className="btn btn-primary h-8">Add</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
