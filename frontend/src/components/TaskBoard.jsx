import React, { useState, useEffect } from 'react';
import {
  CheckSquare,
  Plus,
  Clock,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Trash2,
  MapPin,
  AlertCircle,
  User,
  X,
  Filter,
  Flame,
  UserCheck
} from 'lucide-react';
import { taskService, volunteerService } from '../services/api';

const ZONES = [
  'All Zones',
  'North Gate',
  'South Exit',
  'Main Stage',
  'Medical Tent',
  'Food Court',
  'VIP Lounge',
  'Registration',
  'General'
];

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export default function TaskBoard({
  selectedEventId,
  volunteers = [],
  onTaskChange
}) {
  const [tasks, setTasks] = useState([]);
  const [localVolunteers, setLocalVolunteers] = useState(volunteers);
  const [loading, setLoading] = useState(false);
  const [selectedZone, setSelectedZone] = useState('All Zones');
  const [showModal, setShowModal] = useState(false);
  const [assigningTaskId, setAssigningTaskId] = useState(null);

  // New task form state
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    zone: 'North Gate',
    priority: 'MEDIUM',
    status: 'OPEN',
    assigned_volunteer_id: ''
  });

  // Ensure volunteers list is available
  useEffect(() => {
    if (volunteers && volunteers.length > 0) {
      setLocalVolunteers(volunteers);
    } else {
      volunteerService.getVolunteers()
        .then((res) => setLocalVolunteers(res.data))
        .catch((err) => console.error("Could not fetch volunteers for tasks:", err));
    }
  }, [volunteers]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedEventId) params.event_id = selectedEventId;
      if (selectedZone && selectedZone !== 'All Zones') params.zone = selectedZone;
      const res = await taskService.getTasks(params);
      setTasks(res.data);
    } catch (err) {
      console.error("Error fetching tasks:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [selectedEventId, selectedZone]);

  // Handle status update
  const handleUpdateStatus = async (taskId, newStatus) => {
    // Optimistic UI update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );

    try {
      await taskService.updateTask(taskId, { status: newStatus });
      await fetchTasks();
      if (onTaskChange) onTaskChange();
    } catch (err) {
      alert("Error updating task status: " + (err.response?.data?.detail || err.message));
      fetchTasks();
    }
  };

  // Handle volunteer assignment directly on card
  const handleAssignVolunteer = async (taskId, volunteerId) => {
    const vid = volunteerId ? Number(volunteerId) : null;
    const volObj = localVolunteers.find((v) => v.id === vid) || null;

    // Optimistic UI update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, assigned_volunteer_id: vid, assigned_volunteer: volObj }
          : t
      )
    );
    setAssigningTaskId(null);

    try {
      await taskService.updateTask(taskId, { assigned_volunteer_id: vid });
      await fetchTasks();
      if (onTaskChange) onTaskChange();
    } catch (err) {
      alert("Error assigning volunteer: " + (err.response?.data?.detail || err.message));
      fetchTasks();
    }
  };

  // Handle task deletion
  const handleDeleteTask = async (taskId) => {
    if (!confirm("Are you sure you want to delete this task?")) return;
    try {
      await taskService.deleteTask(taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      if (onTaskChange) onTaskChange();
    } catch (err) {
      alert("Error deleting task: " + (err.response?.data?.detail || err.message));
      fetchTasks();
    }
  };

  // Handle task creation
  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTask.title.trim()) {
      alert("Please provide a task title.");
      return;
    }

    try {
      const payload = {
        title: newTask.title.trim(),
        description: newTask.description.trim(),
        zone: newTask.zone,
        priority: newTask.priority,
        status: 'OPEN',
        assigned_volunteer_id: newTask.assigned_volunteer_id
          ? Number(newTask.assigned_volunteer_id)
          : null,
        event_id: selectedEventId ? Number(selectedEventId) : null
      };

      await taskService.createTask(payload);
      setShowModal(false);
      setNewTask({
        title: '',
        description: '',
        zone: 'North Gate',
        priority: 'MEDIUM',
        status: 'OPEN',
        assigned_volunteer_id: ''
      });
      await fetchTasks();
      if (onTaskChange) onTaskChange();
    } catch (err) {
      alert("Error creating task: " + (err.response?.data?.detail || err.message));
    }
  };

  // 3 Kanban Columns strictly adhering to allowed statuses
  const columns = [
    {
      id: 'OPEN',
      label: 'OPEN',
      color: 'border-amber-500/40 text-amber-400 bg-amber-500/10',
      badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30'
    },
    {
      id: 'IN_PROGRESS',
      label: 'IN PROGRESS',
      color: 'border-blue-500/40 text-blue-400 bg-blue-500/10',
      badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30'
    },
    {
      id: 'RESOLVED',
      label: 'RESOLVED',
      color: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10',
      badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
    }
  ];

  const getPriorityStyle = (priority) => {
    const p = String(priority || 'MEDIUM').toUpperCase();
    switch (p) {
      case 'CRITICAL':
      case 'URGENT':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse';
      case 'HIGH':
        return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
      case 'MEDIUM':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'LOW':
      default:
        return 'bg-slate-700/60 text-slate-300 border-slate-600';
    }
  };

  // Filter tasks based on status and zone
  const filteredTasks = tasks.filter((t) => {
    if (selectedZone !== 'All Zones' && t.zone !== selectedZone) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-800 gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-indigo-400" />
            Live Ground Task Board
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time Kanban dispatching field operations, supply runs, and security sweeps to active volunteers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Zone Filter */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 shadow-sm">
            <Filter className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-xs text-slate-400 font-medium">Zone:</span>
            <select
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
              className="bg-transparent text-xs text-white font-medium focus:outline-none cursor-pointer"
            >
              {ZONES.map((z) => (
                <option key={z} value={z} className="bg-slate-800 text-white">
                  {z}
                </option>
              ))}
            </select>
          </div>

          {/* Create Task Button */}
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Task</span>
          </button>
        </div>
      </div>

      {/* Kanban Board Columns */}
      {loading && tasks.length === 0 ? (
        <div className="p-12 text-center text-slate-400 text-sm">Loading task board...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {columns.map((col) => {
            const colTasks = filteredTasks.filter((t) => {
              const s = String(t.status || '').toUpperCase();
              if (col.id === 'OPEN') return s === 'OPEN' || s === 'TODO';
              if (col.id === 'IN_PROGRESS') return s === 'IN_PROGRESS' || s === 'IN PROGRESS';
              if (col.id === 'RESOLVED') return s === 'RESOLVED' || s === 'DONE';
              return false;
            });

            return (
              <div
                key={col.id}
                className="bg-slate-900/60 rounded-2xl border border-slate-800 p-4 flex flex-col min-h-[520px]"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-white text-sm tracking-wide">
                      {col.label}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${col.badge}`}>
                      {colTasks.length}
                    </span>
                  </div>
                </div>

                {/* Task Cards Container */}
                <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                  {colTasks.length === 0 ? (
                    <div className="h-32 flex flex-col items-center justify-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl p-4 text-center">
                      <span>No tasks in {col.label}</span>
                      {selectedZone !== 'All Zones' && (
                        <span className="text-[10px] text-slate-600 mt-1">
                          (Filter: {selectedZone})
                        </span>
                      )}
                    </div>
                  ) : (
                    colTasks.map((task) => (
                      <div
                        key={task.id}
                        className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/60 hover:border-slate-600 transition-all shadow-md group flex flex-col justify-between"
                      >
                        <div>
                          {/* Priority and Zone Badges */}
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getPriorityStyle(task.priority)}`}>
                              {task.priority || 'MEDIUM'}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                              <MapPin className="w-3 h-3 text-indigo-400" />
                              {task.zone}
                            </span>
                          </div>

                          {/* Task Title & Description */}
                          <h4 className="font-bold text-white text-sm leading-snug">
                            {task.title}
                          </h4>
                          {task.description && (
                            <p className="text-xs text-slate-300 mt-1 line-clamp-3 leading-relaxed">
                              {task.description}
                            </p>
                          )}

                          {/* Assigned Volunteer Control */}
                          <div className="mt-3 pt-2.5 border-t border-slate-700/40 flex items-center justify-between text-xs gap-2">
                            {assigningTaskId === task.id ? (
                              <div className="flex-1 flex items-center gap-1">
                                <select
                                  defaultValue={task.assigned_volunteer_id || ''}
                                  onChange={(e) => handleAssignVolunteer(task.id, e.target.value)}
                                  className="w-full bg-slate-900 border border-indigo-500 rounded-lg text-[11px] text-white px-2 py-1 focus:outline-none"
                                >
                                  <option value="">-- Unassigned --</option>
                                  {localVolunteers.map((v) => (
                                    <option key={v.id} value={v.id}>
                                      {v.full_name || v.name}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => setAssigningTaskId(null)}
                                  className="text-slate-400 hover:text-white p-1"
                                  title="Cancel"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <div
                                onClick={() => setAssigningTaskId(task.id)}
                                title="Click to assign or change volunteer"
                                className="flex items-center gap-1.5 text-slate-300 hover:text-indigo-300 cursor-pointer transition-colors"
                              >
                                <User className="w-3.5 h-3.5 text-indigo-400" />
                                <span className="text-[11px] font-medium">
                                  {task.assigned_volunteer?.full_name ||
                                    task.assigned_volunteer?.name ||
                                    'Unassigned'}
                                </span>
                                <span className="text-[10px] text-slate-500 underline ml-0.5">
                                  edit
                                </span>
                              </div>
                            )}

                            {/* Delete Option */}
                            <button
                              onClick={() => handleDeleteTask(task.id)}
                              title="Delete task"
                              className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Move Actions / Status Controls */}
                        <div className="mt-3 pt-2.5 border-t border-slate-700/40 flex items-center justify-between gap-2">
                          {col.id === 'OPEN' && (
                            <button
                              onClick={() => handleUpdateStatus(task.id, 'IN_PROGRESS')}
                              className="w-full py-1.5 px-3 bg-indigo-600/80 hover:bg-indigo-600 text-white text-[11px] font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                            >
                              <span>Start Task</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}

                          {col.id === 'IN_PROGRESS' && (
                            <>
                              <button
                                onClick={() => handleUpdateStatus(task.id, 'OPEN')}
                                className="px-2.5 py-1.5 bg-slate-700/60 hover:bg-slate-700 text-slate-300 text-[11px] font-medium rounded-lg flex items-center gap-1 transition-colors"
                              >
                                <ArrowLeft className="w-3 h-3" />
                                <span>Reopen</span>
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(task.id, 'RESOLVED')}
                                className="px-3 py-1.5 bg-emerald-600/80 hover:bg-emerald-600 text-white text-[11px] font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-sm ml-auto"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Resolve Task</span>
                              </button>
                            </>
                          )}

                          {col.id === 'RESOLVED' && (
                            <button
                              onClick={() => handleUpdateStatus(task.id, 'OPEN')}
                              className="w-full py-1 px-2.5 bg-slate-700/50 hover:bg-slate-700 text-slate-300 text-[11px] font-medium rounded-lg flex items-center justify-center gap-1 transition-colors"
                            >
                              <ArrowLeft className="w-3 h-3" />
                              <span>Reopen to OPEN</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Create Ground Task */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-400" />
                Dispatch Ground Task
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Task Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Deploy 20 extra water cases to Medical Tent"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Description / Instructions
                </label>
                <textarea
                  rows="3"
                  placeholder="Specific checkpoint details, contacts, or instructions"
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Zone *
                  </label>
                  <select
                    value={newTask.zone}
                    onChange={(e) => setNewTask({ ...newTask, zone: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  >
                    {ZONES.filter((z) => z !== 'All Zones').map((z) => (
                      <option key={z} value={z}>
                        {z}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Priority *
                  </label>
                  <select
                    value={newTask.priority}
                    onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Assign Volunteer (Optional)
                </label>
                <select
                  value={newTask.assigned_volunteer_id}
                  onChange={(e) =>
                    setNewTask({ ...newTask, assigned_volunteer_id: e.target.value })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Unassigned (Available in Pool) --</option>
                  {localVolunteers.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.full_name || v.name} ({v.status || 'Active'}) - {v.skills?.substring(0, 30)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/30 transition-all"
                >
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
