import React, { useState, useEffect } from 'react';
import { Plus, Trash2, X, ExternalLink, RefreshCw, Link2, CheckCircle2, AlertCircle } from 'lucide-react';
import { taskService, volunteerService, jiraService } from '../services/api';
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
  const [jiraStatus, setJiraStatus] = useState(null);
  const [syncingTaskId, setSyncingTaskId] = useState(null);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [notification, setNotification] = useState(null);

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

  // Check Jira connection status
  useEffect(() => {
    jiraService.getStatus()
      .then((res) => setJiraStatus(res.data))
      .catch((err) => console.warn("Jira status check error:", err));
  }, []);

  // Auto-dismiss notification after 4.5 seconds
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => {
      setNotification(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [notification]);

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
      const res = await taskService.updateTask(taskId, { status: newStatus });
      await fetchTasks();
      if (onTaskChange) onTaskChange();

      // Show Jira sync feedback per specification
      if (res.data?.jira_sync_status === 'synced' && res.data?.jira_issue_key) {
        setNotification({
          type: 'success',
          message: `Status changed to ${newStatus}. ✓ Jira ${res.data.jira_issue_key} synchronized.`
        });
      } else if (res.data?.jira_sync_status === 'failed') {
        setNotification({
          type: 'warning',
          message: `EVCP status updated locally to ${newStatus}, but Jira synchronization failed.`
        });
      }
    } catch (err) {
      setNotification({
        type: 'error',
        message: "Error updating task status: " + (err.response?.data?.detail || err.message)
      });
      fetchTasks();
    }
  };

  // Handle volunteer assignment directly on card
  const handleAssignVolunteer = async (taskId, volunteerId) => {
    const vid = volunteerId ? Number(volunteerId) : null;
    const volObj = localVolunteers.find((v) => v.id === vid) || null;

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
      setNotification({
        type: 'error',
        message: "Error assigning volunteer: " + (err.response?.data?.detail || err.message)
      });
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
      setNotification({
        type: 'error',
        message: "Error deleting task: " + (err.response?.data?.detail || err.message)
      });
      fetchTasks();
    }
  };

  // Single task sync with Jira
  const handleSyncJira = async (taskId) => {
    try {
      setSyncingTaskId(taskId);
      const res = await taskService.syncWithJira(taskId);
      setNotification({
        type: 'success',
        message: res.data?.message || "✓ Task synchronized with Jira."
      });
      await fetchTasks();
    } catch (err) {
      setNotification({
        type: 'error',
        message: "Error syncing with Jira: " + (err.response?.data?.detail || err.message)
      });
    } finally {
      setSyncingTaskId(null);
    }
  };

  // Global sync all linked tasks from Jira
  const handleSyncAllJira = async () => {
    try {
      setIsSyncingAll(true);
      const res = await jiraService.syncAll();
      setNotification({
        type: 'success',
        message: `Synced ${res.data?.total_linked || 0} Jira tasks (${res.data?.updated || 0} updated from Jira Cloud).`
      });
      await fetchTasks();
    } catch (err) {
      setNotification({
        type: 'error',
        message: "Error in global Jira sync: " + (err.response?.data?.detail || err.message)
      });
    } finally {
      setIsSyncingAll(false);
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

      const res = await taskService.createTask(payload);
      setShowModal(false);
      setNewTask({
        title: '',
        description: '',
        zone: '',
        priority: 'MEDIUM',
        status: 'OPEN',
        assigned_volunteer_id: ''
      });
      
      if (res.data?.jira_issue_key) {
        setNotification({
          type: 'success',
          message: `Created task and linked real Jira issue ${res.data.jira_issue_key}.`
        });
      } else {
        setNotification({
          type: 'info',
          message: 'Task created successfully.'
        });
      }

      await fetchTasks();
      if (onTaskChange) onTaskChange();
    } catch (err) {
      setNotification({
        type: 'error',
        message: "Error creating task: " + (err.response?.data?.detail || err.message)
      });
    }
  };

  // Three columns, one per allowed status
  const columns = [
    { id: 'OPEN', label: 'To Do' },
    { id: 'IN_PROGRESS', label: 'In Progress' },
    { id: 'RESOLVED', label: 'Done' },
  ];

  // Filter tasks based on zone
  const filteredTasks = tasks.filter((t) => {
    if (selectedZone !== 'All Zones' && t.zone !== selectedZone) {
      return false;
    }
    return true;
  });

  return (
    <div className="relative">
      {/* Toast Notification Banner */}
      {notification && (
        <div className={`mb-4 p-3 rounded-2xl border flex items-center justify-between text-sm transition-all shadow-sm ${
          notification.type === 'success'
            ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
            : notification.type === 'warning'
            ? 'bg-amber-50 border-amber-300 text-amber-900'
            : notification.type === 'error'
            ? 'bg-rose-50 border-rose-300 text-rose-900'
            : 'bg-blue-50 border-blue-300 text-blue-900'
        }`}>
          <div className="flex items-center gap-2">
            {notification.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
            {notification.type === 'warning' && <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />}
            {notification.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-neutral-500 hover:text-neutral-800 p-0.5 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">Tasks</h1>
          <p className="page-subtitle">Field coordination & two-way live Jira Cloud synchronization.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Jira Connection Badge */}
          {jiraStatus && (
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-xl border ${
                jiraStatus.connected
                  ? 'bg-blue-50 text-blue-800 border-blue-200'
                  : 'bg-neutral-50 text-neutral-600 border-neutral-200'
              }`}
              title={jiraStatus.connected ? `Connected to Jira Cloud (${jiraStatus.projectKey})` : "Jira integration unverified"}
            >
              <span className={`w-2 h-2 rounded-full ${jiraStatus.connected ? 'bg-blue-600 animate-pulse' : 'bg-neutral-400'}`} />
              Jira: {jiraStatus.projectKey || 'EVCP'}
            </span>
          )}

          {/* Sync All Button */}
          <button
            onClick={handleSyncAllJira}
            disabled={isSyncingAll}
            title="Poll Jira Cloud for status updates on all linked issues"
            className="btn btn-secondary btn-sm h-8 flex items-center gap-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingAll ? 'animate-spin' : ''}`} />
            {isSyncingAll ? 'Syncing…' : 'Sync Jira'}
          </button>

          <select
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value)}
            title="Filter by zone"
            className="input input-sm w-36 h-8"
          >
            {['All Zones', ...zoneOptions].map((z) => (
              <option key={z} value={z}>{z === 'All Zones' ? 'All zones' : z}</option>
            ))}
          </select>

          <button onClick={() => setShowModal(true)} className="btn btn-primary btn-sm h-8">
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
                <h2 className="section-title mb-3 flex items-center justify-between">
                  <span>{col.label}</span>
                  <span className="text-neutral-500 ml-1 text-xs font-semibold tabular-nums px-2 py-0.5 rounded bg-neutral-100">
                    {colTasks.length}
                  </span>
                </h2>

                {colTasks.length === 0 ? (
                  <p className="text-[13px] text-neutral-500 py-8 text-center border border-dashed border-white/60 rounded-2xl bg-neutral-50/50">
                    No tasks
                  </p>
                ) : (
                  <div className="space-y-3">
                    {colTasks.map((task) => {
                      const priority = String(task.priority || 'MEDIUM').toUpperCase();
                      const assignee = task.assigned_volunteer?.full_name || task.assigned_volunteer?.name;
                      const jiraUrl = task.jira_issue_url || (task.jira_issue_key && jiraStatus?.baseUrl ? `${jiraStatus.baseUrl}/browse/${task.jira_issue_key}` : (task.jira_issue_key ? `https://priyanshi1906.atlassian.net/browse/${task.jira_issue_key}` : null));
                      const isTaskSyncing = syncingTaskId === task.id;

                      return (
                        <article key={task.id} className="group rounded-2xl border-2 border-white/80 bg-white p-3.5 shadow-brutal-sm hover:shadow-brutal transition-shadow">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-[13px] font-semibold text-slate-700 leading-snug">{task.title}</h3>
                            <button
                              onClick={() => handleDeleteTask(task.id)}
                              title="Delete task"
                              className="text-neutral-400 hover:text-red-700 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
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
                            <span>{task.zone || 'General'}</span>
                          </div>

                          {/* Jira Integration Bar on Task Card */}
                          <div className="mt-2.5 pt-2 border-t border-dashed border-neutral-200 flex items-center justify-between text-xs">
                            {task.jira_issue_key ? (
                              <>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-neutral-500 uppercase text-[10px] tracking-wider">Jira:</span>
                                  <a
                                    href={jiraUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="font-mono font-medium text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-0.5"
                                    title="Open issue in real Jira board"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    {task.jira_issue_key}
                                  </a>
                                </div>
                                <div className="flex items-center gap-2">
                                  <a
                                    href={jiraUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[11px] font-medium text-neutral-600 hover:text-blue-600 hover:underline"
                                    title="Open in Jira"
                                  >
                                    Open
                                  </a>
                                  <button
                                    onClick={() => handleSyncJira(task.id)}
                                    disabled={isTaskSyncing}
                                    className="text-[11px] font-medium text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-0.5"
                                    title="Sync status with Jira"
                                  >
                                    <RefreshCw className={`w-3 h-3 ${isTaskSyncing ? 'animate-spin' : ''}`} />
                                    Sync
                                  </button>
                                </div>
                              </>
                            ) : (
                              <>
                                <span className="text-neutral-400 text-[11px]">Not linked</span>
                                <button
                                  onClick={() => handleSyncJira(task.id)}
                                  disabled={isTaskSyncing}
                                  className="text-[11px] font-medium text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-0.5"
                                  title="Create and link Jira issue"
                                >
                                  <Link2 className={`w-3 h-3 ${isTaskSyncing ? 'animate-spin' : ''}`} />
                                  {isTaskSyncing ? 'Linking…' : 'Link to Jira'}
                                </button>
                              </>
                            )}
                          </div>

                          {/* Assignment and Status Controls */}
                          <div className="mt-2.5 pt-2 border-t border-neutral-100 flex items-center justify-between gap-2">
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
                                <button onClick={() => setAssigningTaskId(null)} className="text-neutral-600 hover:text-slate-700 p-1" title="Cancel">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setAssigningTaskId(task.id)}
                                title="Assign or change volunteer"
                                className={`text-xs truncate hover:text-slate-700 ${assignee ? 'text-neutral-800 font-medium' : 'text-neutral-400'}`}
                              >
                                {assignee || 'Assign volunteer'}
                              </button>
                            )}

                            <div className="flex items-center gap-1 shrink-0">
                              {col.id === 'OPEN' && (
                                <button onClick={() => handleUpdateStatus(task.id, 'IN_PROGRESS')} className="btn btn-secondary btn-sm h-6 text-xs px-2.5">
                                  Start
                                </button>
                              )}
                              {col.id === 'IN_PROGRESS' && (
                                <>
                                  <button onClick={() => handleUpdateStatus(task.id, 'OPEN')} className="btn btn-ghost btn-sm h-6 text-xs px-2">
                                    Reopen
                                  </button>
                                  <button onClick={() => handleUpdateStatus(task.id, 'RESOLVED')} className="btn btn-secondary btn-sm h-6 text-xs px-2.5">
                                    Resolve
                                  </button>
                                </>
                              )}
                              {col.id === 'RESOLVED' && (
                                <button onClick={() => handleUpdateStatus(task.id, 'OPEN')} className="btn btn-ghost btn-sm h-6 text-xs px-2">
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
              <label className="label">Description</label>
              <textarea
                placeholder="Details, location notes, contacts…"
                rows={3}
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                className="input resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Zone</label>
                <select
                  value={newTask.zone}
                  onChange={(e) => setNewTask({ ...newTask, zone: e.target.value })}
                  className="input"
                  required
                >
                  <option value="">Select zone…</option>
                  {zoneOptions.map((z) => (
                    <option key={z} value={z}>{z}</option>
                  ))}
                </select>
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
              <label className="label">Assign to (optional)</label>
              <select
                value={newTask.assigned_volunteer_id}
                onChange={(e) => setNewTask({ ...newTask, assigned_volunteer_id: e.target.value })}
                className="input"
              >
                <option value="">Unassigned</option>
                {localVolunteers.map((v) => (
                  <option key={v.id} value={v.id}>{v.full_name || v.name}</option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowModal(false)} className="btn btn-ghost">
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Create & Link Jira
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
