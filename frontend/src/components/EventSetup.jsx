import React, { useState, useEffect } from 'react';
import { Calendar, Plus, MapPin, Clock, Shield, Award, Users, CheckCircle } from 'lucide-react';
import { eventService } from '../services/api';

export default function EventSetup({
  events,
  selectedEventId,
  onEventCreated,
  onRoleCreated
}) {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);

  // Form states
  const [newEvent, setNewEvent] = useState({
    name: '',
    description: '',
    location: '',
    start_date: '',
    end_date: '',
    status: 'Active'
  });

  const [newRole, setNewRole] = useState({
    name: '',
    description: '',
    required_skill: 'Crowd Control',
    needed_count: 5
  });

  const currentEvent = events.find(e => e.id === Number(selectedEventId));

  const fetchRoles = async () => {
    if (!selectedEventId) return;
    try {
      setLoading(true);
      const res = await eventService.getRoles(selectedEventId);
      setRoles(res.data);
    } catch (err) {
      console.error("Failed to load roles", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, [selectedEventId]);

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    if (!newEvent.name) return;
    try {
      const res = await eventService.createEvent(newEvent);
      setShowEventModal(false);
      setNewEvent({
        name: '',
        description: '',
        location: '',
        start_date: '',
        end_date: '',
        status: 'Active'
      });
      if (onEventCreated) onEventCreated(res.data);
    } catch (err) {
      alert("Error creating event: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleCreateRole = async (e) => {
    e.preventDefault();
    if (!newRole.name || !selectedEventId) return;
    try {
      await eventService.createRole({
        ...newRole,
        event_id: Number(selectedEventId)
      });
      setShowRoleModal(false);
      setNewRole({
        name: '',
        description: '',
        required_skill: 'Crowd Control',
        needed_count: 5
      });
      fetchRoles();
      if (onRoleCreated) onRoleCreated();
    } catch (err) {
      alert("Error creating role: " + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner with Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-400" />
            Event & Role Configuration
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure event schedules, venue zones, and volunteer specialized role quotas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowEventModal(true)}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-semibold rounded-xl border border-slate-700 flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Event</span>
          </button>
          <button
            onClick={() => setShowRoleModal(true)}
            disabled={!selectedEventId}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Role Requirement</span>
          </button>
        </div>
      </div>

      {/* Active Event Overview Card */}
      {currentEvent && (
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {currentEvent.status}
                </span>
                <span className="text-xs text-slate-400">ID: #{currentEvent.id}</span>
              </div>
              <h3 className="text-xl font-bold text-white mt-1.5">{currentEvent.name}</h3>
              <p className="text-sm text-slate-300 mt-1">{currentEvent.description}</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 text-xs text-slate-400 border-t md:border-t-0 md:border-l border-slate-800 pt-3 md:pt-0 md:pl-6">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>{currentEvent.location || 'Venue TBA'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{currentEvent.start_date || 'TBA'} - {currentEvent.end_date || 'TBA'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Roles Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-400" />
            Specialized Volunteer Roles ({roles.length})
          </h3>
          <span className="text-xs text-slate-400">
            Total Staff Quota: {roles.reduce((acc, r) => acc + (r.needed_count || 0), 0)} positions
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading roles...</div>
        ) : roles.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 text-slate-400 text-sm">
            No roles set up for this event yet. Click "Add Role Requirement" to define one.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {roles.map((role) => (
              <div
                key={role.id}
                className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-bold text-white text-base">{role.name}</h4>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 whitespace-nowrap">
                      {role.needed_count} Needed
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 mt-2 line-clamp-2">{role.description || 'No description provided.'}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-amber-400">
                    <Award className="w-3.5 h-3.5" />
                    <span className="font-medium">{role.required_skill || 'General'}</span>
                  </div>
                  <span className="text-slate-500 text-[11px]">Role #{role.id}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: Create Event */}
      {showEventModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Create New Event</h3>
            <form onSubmit={handleCreateEvent} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Event Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. City Marathon 2026"
                  value={newEvent.name}
                  onChange={(e) => setNewEvent({ ...newEvent, name: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Description</label>
                <textarea
                  rows="2"
                  placeholder="Brief overview of event scope"
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Location / Venue</label>
                <input
                  type="text"
                  placeholder="e.g. Waterfront Park, Sector 4"
                  value={newEvent.location}
                  onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Start Date / Time</label>
                  <input
                    type="text"
                    placeholder="2026-10-02 08:00"
                    value={newEvent.start_date}
                    onChange={(e) => setNewEvent({ ...newEvent, start_date: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">End Date / Time</label>
                  <input
                    type="text"
                    placeholder="2026-10-04 22:00"
                    value={newEvent.end_date}
                    onChange={(e) => setNewEvent({ ...newEvent, end_date: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEventModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/30"
                >
                  Create Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Role */}
      {showRoleModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Add Role Requirement</h3>
            <form onSubmit={handleCreateRole} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Role Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Emergency First Responder"
                  value={newRole.name}
                  onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Description</label>
                <textarea
                  rows="2"
                  placeholder="Responsibilities and operating zones"
                  value={newRole.description}
                  onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Required Skill</label>
                  <select
                    value={newRole.required_skill}
                    onChange={(e) => setNewRole({ ...newRole, required_skill: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Crowd Control">Crowd Control</option>
                    <option value="First Aid">First Aid / CPR</option>
                    <option value="Customer Service">Customer Service</option>
                    <option value="VIP Handling">VIP Handling</option>
                    <option value="Logistics">Logistics</option>
                    <option value="Security">Security</option>
                    <option value="Multilingual">Multilingual</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Volunteers Needed</label>
                  <input
                    type="number"
                    min="1"
                    value={newRole.needed_count}
                    onChange={(e) => setNewRole({ ...newRole, needed_count: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowRoleModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/30"
                >
                  Save Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
