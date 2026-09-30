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
  X
} from 'lucide-react';
import { taskService } from '../services/api';

export default function TaskBoard({
  selectedEventId,
  volunteers,
  onTaskChange
}) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // New task form
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    zone: 'North Gate',
    priority: 'Medium',
    status: 'todo',
    assigned_volunteer_id: ''
  });

  const fetchTasks = async () => {
    if (!selectedEventId) return;
    try {
      setLoading(true);
      const res = await taskService.getTasks(selectedEventId);
      setTasks(res.data);
    } catch (err) {
      console.error("Error fetching tasks:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [selectedEventId]);

  const handleUpdateStatus = async (taskId, newStatus) => {
    try {
      await taskService.updateTask(taskId, { status: newStatus });
      await fetchTasks();
      if (onTaskChange) onTaskChange();
    } catch (err) {
      alert("Error updating task status: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!confirm("Are you sure you want to delete this task?")) return;
    try {
      await taskService.deleteTask(taskId);
      await fetchTasks();
      if (onTaskChange) onTaskChange();
    } catch (err) {
      alert("Error deleting task: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTask.title || !selectedEventId) return;
    try {
      await taskService.createTask({
        ...newTask,
        event_id: Number(selectedEventId),
        assigned_volunteer_id: newTask.assigned_volunteer_id
          ? Number(newTask.assigned_volunteer_id)
          : null
      });
      setShowModal(false);
      setNewTask({
        title: '',
        description: '',
        zone: 'North Gate',
        priority: 'Medium',
        status: 'todo',
        assigned_volunteer_id: ''
      });
      fetchTasks();
      if (onTaskChange) onTaskChange();
    } catch (err) {
      alert("Error creating task: " + (err.response?.data?.detail || err.message));
    }
  };

  const columns = [
    {
      id: 'todo',
      label: 'To Do',
      color: 'border-amber-500/40 text-amber-400 bg-amber-500/10',
      count: tasks.filter(t => t.status === 'todo').length
    },
    {
      id: 'in_progress',
      label: 'In Progress',
      color: 'border-blue-500/40 text-blue-400 bg-blue-500/10',
      count: tasks.filter(t => t.status === 'in_progress').length
    },
    {
      id: 'done',
      label: 'Completed',
      color: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10',
      count: tasks.filter(t => t.status === 'done').length
    }
  ];

  const getPriorityStyle = (priority) => {
    switch (priority) {
      case 'Urgent':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      case 'High':
        return 'bg-orange-500/10 text-orange-400 border-orange-500/30';
      case 'Medium':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      default:
        return 'bg-slate-700 text-slate-300 border-slate-600';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-indigo-400" />
            Live Ground Task Dispatch Board
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time Kanban dispatching field operations, supply runs, and security sweeps to active volunteers.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 self-start sm:self-auto transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Dispatch New Task</span>
        </button>
      </div>

      {/* Kanban Board Columns */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 text-sm">Loading task board...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {columns.map((col) => {
            const colTasks = tasks.filter(t => t.status === col.id);

            return (
              <div
                key={col.id}
                className="bg-slate-900/60 rounded-2xl border border-slate-800 p-4 flex flex-col min-h-[500px]"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">{col.label}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${col.color}`}>
                      {col.count}
                    </span>
                  </div>
                </div>

                {/* Task Cards Container */}
                <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                  {colTasks.length === 0 ? (
                    <div className="h-32 flex items-center justify-center text-xs text-slate-400 border border-dashed border-slate-800 rounded-xl">
                      No tasks in {col.label.toLowerCase()}
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
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getPriorityStyle(task.priority)}`}>
                              {task.priority} Priority
                            </span>
                            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                              <MapPin className="w-3 h-3 text-indigo-400" />
                              {task.zone}
                            </span>
                          </div>

                          <h4 className="font-bold text-white text-sm leading-snug">{task.title}</h4>
                          {task.description && (
                            <p className="text-xs text-slate-300 mt-1 line-clamp-2">{task.description}</p>
                          )}

                          {/* Assigned Volunteer */}
                          <div className="mt-3 pt-2.5 border-t border-slate-700/40 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5 text-slate-300">
                              <User className="w-3.5 h-3.5 text-indigo-400" />
                              <span className="text-[11px]">
                                {task.assigned_volunteer?.full_name || 'Unassigned'}
                              </span>
                            </div>
                            <button
                              onClick={() => handleDeleteTask(task.id)}
                              title="Delete task"
                              className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {/* Move Actions */}
                        <div className="mt-3 pt-2.5 border-t border-slate-700/40 flex items-center justify-between gap-2">
                          {col.id !== 'todo' && (
                            <button
                              onClick={() => handleUpdateStatus(task.id, col.id === 'done' ? 'in_progress' : 'todo')}
                              className="px-2 py-1 bg-slate-700/60 hover:bg-slate-700 text-slate-300 text-[11px] font-medium rounded-lg flex items-center gap-1 transition-colors"
                            >
                              <ArrowLeft className="w-3 h-3" />
                              <span>Back</span>
                            </button>
                          )}

                          <div className="ml-auto">
                            {col.id !== 'done' && (
                              <button
                                onClick={() => handleUpdateStatus(task.id, col.id === 'todo' ? 'in_progress' : 'done')}
                                className="px-2.5 py-1 bg-indigo-600/80 hover:bg-indigo-600 text-white text-[11px] font-medium rounded-lg flex items-center gap-1 transition-colors shadow-sm"
                              >
                                <span>{col.id === 'todo' ? 'Start Task' : 'Complete'}</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            )}
                          </div>
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

      {/* Modal: Dispatch New Task */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Dispatch Ground Task</h3>
            <form onSubmit={handleCreateTask} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Task Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Deliver extra ice packs to medical tent"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Description / Instructions</label>
                <textarea
                  rows="2"
                  placeholder="Specific checkpoint details or contact person"
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Target Zone</label>
                  <select
                    value={newTask.zone}
                    onChange={(e) => setNewTask({ ...newTask, zone: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="North Gate">North Gate</option>
                    <option value="South Exit">South Exit</option>
                    <option value="Main Stage">Main Stage</option>
                    <option value="Medical Tent">Medical Tent</option>
                    <option value="Food Court">Food Court</option>
                    <option value="VIP Lounge">VIP Lounge</option>
                    <option value="Registration">Registration</option>
                    <option value="General">General</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Priority</label>
                  <select
                    value={newTask.priority}
                    onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Assign Volunteer (Optional)</label>
                <select
                  value={newTask.assigned_volunteer_id}
                  onChange={(e) => setNewTask({ ...newTask, assigned_volunteer_id: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Unassigned (Available in Pool) --</option>
                  {volunteers.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.full_name} ({v.status}) - {v.skills?.substring(0, 30)}
                    </option>
                  ))}
                </select>
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
                  Dispatch Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
