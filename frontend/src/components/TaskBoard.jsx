import React, { useState, useEffect } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { taskService, volunteerService } from '../services/api';
import Modal from './Modal';
import { useZoneNames } from '../services/useOptions';

const PRIORITY_DOT = {
  CRITICAL: 'bg-brand-red',
  URGENT: 'bg-brand-red',
  HIGH: 'bg-brand-orange',
  MEDIUM: 'bg-brand-blue',
  LOW: 'bg-neutral-300',
};

const PRIORITY_TEXT = {
  CRITICAL: 'text-red-700',
  URGENT: 'text-red-700',
  HIGH: 'text-orange-700',
};

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
  const zoneOptions = useZoneNames(selectedEventId);
  const [showModal, setShowModal] = useState(false);
  const [assigningTaskId, setAssigningTaskId] = useState(null);

  // New task form state
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    zone: '',
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
        zone: '',
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

  // Three columns, one per allowed status
  const columns = [
    { id: 'OPEN', label: 'Open' },
    { id: 'IN_PROGRESS', label: 'In progress' },
    { id: 'RESOLVED', label: 'Resolved' },
  ];

  // Filter tasks based on zone
  const filteredTasks = tasks.filter((t) => {
    if (selectedZone !== 'All Zones' && t.zone !== selectedZone) {
      return false;
    }
    return true;
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Tasks</h1>
          <p className="page-subtitle">Field work by zone and status.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value)}
            title="Filter by zone"
            className="input input-sm w-40"
          >
            {['All Zones', ...zoneOptions].map((z) => (
              <option key={z} value={z}>{z === 'All Zones' ? 'All zones' : z}</option>
            ))}
          </select>
          <button onClick={() => setShowModal(true)} className="btn btn-primary">
            <Plus className="w-4 h-4" /> New task
          </button>
        </div>
      </div>

      {loading && tasks.length === 0 ? (
        <div className="empty">Loading tasks…</div>
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
              <section key={col.id}>
                <h2 className="section-title mb-3">
                  {col.label} <span className="text-neutral-500 ml-1 tabular-nums">{colTasks.length}</span>
                </h2>

                {colTasks.length === 0 ? (
                  <p className="text-[13px] text-neutral-500 py-6 text-center border border-dashed border-ink rounded-lg">
                    No tasks
                  </p>
                ) : (
                  <div className="space-y-2">
                    {colTasks.map((task) => {
                      const priority = String(task.priority || 'MEDIUM').toUpperCase();
                      const assignee = task.assigned_volunteer?.full_name || task.assigned_volunteer?.name;
                      return (
                        <article key={task.id} className="group rounded-lg border-2 border-ink bg-white p-3 shadow-brutal-sm">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-[13px] text-ink leading-snug">{task.title}</h3>
                            <button
                              onClick={() => handleDeleteTask(task.id)}
                              title="Delete task"
                              className="text-neutral-500 hover:text-red-700 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {task.description && (
                            <p className="text-xs text-neutral-600 mt-1 line-clamp-2">{task.description}</p>
                          )}

                          <div className="mt-2.5 flex items-center gap-1.5 text-xs text-neutral-600 flex-wrap">
                            <span className={`dot ${PRIORITY_DOT[priority] || 'bg-neutral-300'}`} />
                            <span className={PRIORITY_TEXT[priority] || ''}>{priority.charAt(0) + priority.slice(1).toLowerCase()}</span>
                            <span>·</span>
                            <span>{task.zone}</span>
                          </div>

                          <div className="mt-2.5 flex items-center justify-between gap-2">
                            {assigningTaskId === task.id ? (
                              <div className="flex-1 flex items-center gap-1">
                                <select
                                  autoFocus
                                  defaultValue={task.assigned_volunteer_id || ''}
                                  onChange={(e) => handleAssignVolunteer(task.id, e.target.value)}
                                  className="input input-sm h-7 text-xs"
                                >
                                  <option value="">Unassigned</option>
                                  {localVolunteers.map((v) => (
                                    <option key={v.id} value={v.id}>{v.full_name || v.name}</option>
                                  ))}
                                </select>
                                <button onClick={() => setAssigningTaskId(null)} className="text-neutral-600 hover:text-ink p-1" title="Cancel">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setAssigningTaskId(task.id)}
                                title="Assign or change volunteer"
                                className={`text-xs truncate hover:text-ink ${assignee ? 'text-neutral-800' : 'text-neutral-500'}`}
                              >
                                {assignee || 'Assign volunteer'}
                              </button>
                            )}

                            <div className="flex items-center gap-1 shrink-0">
                              {col.id === 'OPEN' && (
                                <button onClick={() => handleUpdateStatus(task.id, 'IN_PROGRESS')} className="btn btn-secondary btn-sm h-6">
                                  Start
                                </button>
                              )}
                              {col.id === 'IN_PROGRESS' && (
                                <>
                                  <button onClick={() => handleUpdateStatus(task.id, 'OPEN')} className="btn btn-ghost btn-sm h-6">
                                    Reopen
                                  </button>
                                  <button onClick={() => handleUpdateStatus(task.id, 'RESOLVED')} className="btn btn-secondary btn-sm h-6">
                                    Resolve
                                  </button>
                                </>
                              )}
                              {col.id === 'RESOLVED' && (
                                <button onClick={() => handleUpdateStatus(task.id, 'OPEN')} className="btn btn-ghost btn-sm h-6">
                                  Reopen
                                </button>
                              )}
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {showModal && (
        <Modal title="New task" onClose={() => setShowModal(false)}>
          <form onSubmit={handleCreateTask} className="space-y-4 pb-1">
            <div>
              <label className="label">Title</label>
              <input
                type="text"
                required
                placeholder="e.g. Move 20 water cases to the medical tent"
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                className="input"
              />
            </div>

            <div>
              <label className="label">Instructions <span className="text-neutral-500">(optional)</span></label>
              <textarea
                rows="3"
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                className="input"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Zone</label>
<input
                  type="text"
                  required
                  list="task-zone-options"
                  value={newTask.zone}
                  onChange={(e) => setNewTask({ ...newTask, zone: e.target.value })}
                  className="input"
                />
                <datalist id="task-zone-options">
                  {zoneOptions.map((z) => <option key={z} value={z} />)}
                </datalist>
              </div>
              <div>
                <label className="label">Priority</label>
                <select
                  value={newTask.priority}
                  onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                  className="input"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="label">Assign to <span className="text-neutral-500">(optional)</span></label>
              <select
                value={newTask.assigned_volunteer_id}
                onChange={(e) => setNewTask({ ...newTask, assigned_volunteer_id: e.target.value })}
                className="input"
              >
                <option value="">Unassigned</option>
                {localVolunteers.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.full_name || v.name} · {v.status || 'Available'}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowModal(false)} className="btn btn-ghost">Cancel</button>
              <button type="submit" className="btn btn-primary">Create task</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
