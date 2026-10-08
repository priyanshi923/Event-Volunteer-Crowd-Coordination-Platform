import React, { useState, useEffect } from 'react';
import { LogOut } from 'lucide-react';
import { volunteerService, taskService, shiftService, commsService, issueService } from '../services/api';
import Modal from './Modal';
import { useZoneNames } from '../services/useOptions';
import { parseServerDate } from '../services/dates';
import { getCurrentVolunteerId, clearSession } from '../services/session';

const VOLUNTEER_TABS = [
  { id: 'dashboard', label: 'Home' },
  { id: 'shifts',    label: 'My shifts' },
  { id: 'tasks',     label: 'My tasks' },
  { id: 'profile',   label: 'Profile' },
];

const ISSUE_TYPES = ['MEDICAL', 'CROWD_SURGE', 'MISSING_EQUIPMENT', 'SECURITY', 'OTHER'];

const ASSIGNMENT_STATUS_LABEL = {
  ASSIGNED: 'Assigned',
  CHECKED_IN: 'Checked in',
  COMPLETED: 'Completed',
  DROPPED_OUT: 'Dropped out',
  NO_SHOW: 'No-show',
};

const ASSIGNMENT_STATUS_TEXT = {
  CHECKED_IN: 'text-green-700',
  COMPLETED: 'text-neutral-600',
  DROPPED_OUT: 'text-red-700',
  NO_SHOW: 'text-red-700',
};

const TASK_STATUS_LABEL = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  RESOLVED: 'Resolved',
};

const PRIORITY_COLORS = {
  HIGH:     'text-orange-700',
  CRITICAL: 'text-red-700',
};

export default function VolunteerDashboard({ onSwitchRole, selectedEventId }) {
  const volunteerId = getCurrentVolunteerId();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [profile, setProfile] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  // Report issue form
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [issueForm, setIssueForm] = useState({
    title: '', description: '', zone: 'General', issue_type: 'OTHER', priority: 'MEDIUM'
  });
  const [issueSubmitting, setIssueSubmitting] = useState(false);
  const zoneOptions = useZoneNames(selectedEventId);
  const [issueSuccess, setIssueSuccess] = useState('');

  useEffect(() => { loadAll(); }, [volunteerId, selectedEventId]);

  const loadAll = async () => {
    if (!volunteerId) return;
    setLoading(true);
    try {
      const taskParams = { volunteer_id: volunteerId };
      if (selectedEventId) taskParams.event_id = selectedEventId;

      const [profileRes, tasksRes, announcementsRes] = await Promise.all([
        volunteerService.getVolunteer(volunteerId),
        taskService.getTasks(taskParams),
        commsService.getAnnouncements(
          selectedEventId
            ? { event_id: selectedEventId, volunteer_id: volunteerId }
            : { volunteer_id: volunteerId }
        ),
      ]);
      setProfile(profileRes.data);
      setTasks(tasksRes.data);
      setAnnouncements(announcementsRes.data);

      // Always fetch shifts for this volunteer; filter by event if available
      try {
        const shiftParams = { volunteer_id: volunteerId };
        if (selectedEventId) shiftParams.event_id = selectedEventId;
        const assignmentsRes = await shiftService.getAssignments(shiftParams);
        setShifts(assignmentsRes.data || []);
      } catch {
        setShifts([]);
      }
    } catch (err) {
      // Stored volunteer no longer exists (e.g. database reseeded): return to landing
      if (err.response?.status === 404) {
        clearSession();
        onSwitchRole();
        return;
      }
      console.error('Volunteer dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };


  const showMsg = (msg, isError = false) => {
    setStatusMsg({ text: msg, error: isError });
    setTimeout(() => setStatusMsg(null), 3000);
  };

  const handleCheckIn = async () => {
    setActionLoading(true);
    try {
      await volunteerService.checkIn(volunteerId);
      showMsg('Checked in successfully!');
      await loadAll();
    } catch (err) {
      showMsg(err.response?.data?.detail || 'Check-in failed.', true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    setActionLoading(true);
    try {
      await volunteerService.checkOut(volunteerId);
      showMsg('Checked out successfully!');
      await loadAll();
    } catch (err) {
      showMsg(err.response?.data?.detail || 'Check-out failed.', true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateTaskStatus = async (taskId, newStatus) => {
    try {
      await taskService.updateTask(taskId, { status: newStatus });
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: newStatus } : t));
    } catch (err) {
      showMsg('Could not update task status.', true);
    }
  };

  const handleSubmitIssue = async (e) => {
    e.preventDefault();
    if (!issueForm.title.trim()) return;
    setIssueSubmitting(true);
    try {
      await issueService.createIssue({
        ...issueForm,
        event_id: selectedEventId || null
      });
      setIssueSuccess('Issue reported successfully. A coordinator has been notified.');
      setIssueForm({ title: '', description: '', zone: 'General', issue_type: 'OTHER', priority: 'MEDIUM' });
      setShowIssueForm(false);
      setTimeout(() => setIssueSuccess(''), 4000);
    } catch (err) {
      showMsg(err.response?.data?.detail || 'Failed to report issue.', true);
    } finally {
      setIssueSubmitting(false);
    }
  };

  const handleSwitchRole = () => { clearSession(); onSwitchRole(); };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-[13px] text-neutral-600">Loading…</div>;
  }

  const isCheckedIn  = profile?.status === 'Checked In';
  const isCheckedOut = profile?.status === 'Checked Out';
  const firstName = (profile?.full_name || 'there').split(' ')[0];
  const upcomingShifts = shifts.filter((s) => ['ASSIGNED', 'CHECKED_IN'].includes((s.assignment_status || '').toUpperCase()));
  const nextShift = upcomingShifts[0];
  const openTaskCount = tasks.filter((t) => t.status !== 'RESOLVED').length;

  const shiftTime = (s) => {
    const start = s.start_time || s.shift_start;
    const end = s.end_time || s.shift_end;
    return start ? `${start}–${end}` : '';
  };

  return (
    <div className="min-h-screen flex flex-col">
      {statusMsg && (
        <div role="status" className={`fixed bottom-5 right-5 z-50 max-w-sm rounded-xl border-2 border-white/80 px-4 py-2.5 text-[13px] font-bold text-slate-700 shadow-brutal ${statusMsg.error ? 'bg-brand-red' : 'bg-brand-yellow'}`}>
          {statusMsg.text}
        </div>
      )}

      <header className="sticky top-0 z-40 bg-transparent border-b-[3px] border-white/60">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16 gap-4">
          <div className="flex items-center gap-6 min-w-0">
            <span className="shrink-0 rounded-xl border-2 border-white/80 bg-brand-pink px-2 py-1 text-sm font-bold tracking-tight shadow-brutal-sm -rotate-2">CrowdCoord</span>
            <nav className="flex items-center gap-1 overflow-x-auto">
              {VOLUNTEER_TABS.map((tab) => (
                <button
                  key={tab.id}
                  id={`volunteer-tab-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`h-9 px-3 rounded-xl border-2 text-[13px] font-bold whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? 'border-white/60 bg-brand-yellow shadow-brutal-sm'
                      : 'border-transparent hover:border-white/60 hover:bg-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
          <button id="volunteer-switch-role-btn" onClick={handleSwitchRole} className="btn btn-secondary px-2.5 shrink-0" title="Switch role">
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Switch role</span>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-8">

        {/* Home */}
        {activeTab === 'dashboard' && (
          <div className="space-y-10">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h1 className="page-title">Hi, {firstName}</h1>
                <p className="page-subtitle flex items-center gap-2">
                  <span className={`dot ${isCheckedIn ? 'bg-brand-green' : isCheckedOut ? 'bg-neutral-300' : 'bg-brand-blue'}`} />
                  {profile?.status}
                  {profile?.total_hours_worked > 0 && <> · {(profile.total_hours_worked).toFixed(1)}h worked</>}
                </p>
              </div>
              {!isCheckedIn && !isCheckedOut && (
                <button onClick={handleCheckIn} disabled={actionLoading} className="btn btn-primary h-9 px-4">Check in</button>
              )}
              {isCheckedIn && (
                <button onClick={handleCheckOut} disabled={actionLoading} className="btn btn-secondary h-9 px-4">Check out</button>
              )}
            </div>

            <section>
              <h2 className="section-title mb-2">Next shift</h2>
              {nextShift ? (
                <button onClick={() => setActiveTab('shifts')} className="w-full text-left card-lift bg-brand-blue px-4 py-3">
                  <p className="text-[13px] text-slate-700">{nextShift.shift_title || nextShift.title}</p>
                  <p className="text-xs text-neutral-600 mt-0.5">
                    {[nextShift.shift_date, shiftTime(nextShift), nextShift.zone].filter(Boolean).join(' · ')}
                  </p>
                </button>
              ) : (
                <p className="text-[13px] text-neutral-600">No upcoming shifts. A coordinator will assign you.</p>
              )}
              {openTaskCount > 0 && (
                <button onClick={() => setActiveTab('tasks')} className="mt-3 text-[13px] text-neutral-700 hover:text-slate-700">
                  {openTaskCount} open task{openTaskCount > 1 ? 's' : ''} →
                </button>
              )}
            </section>

            <section>
              <h2 className="section-title mb-2">Announcements</h2>
              {announcements.length === 0 ? (
                <p className="text-[13px] text-neutral-600">No announcements yet.</p>
              ) : (
                <ul className="divide-rows">
                  {announcements.slice(0, 5).map((a) => (
                    <li key={a.id} className="py-3 first:pt-1">
                      <p className="text-[13px] text-slate-700">{a.title || a.message || 'Announcement'}</p>
                      {(a.message || a.content) && <p className="text-xs text-neutral-700 mt-1">{a.message || a.content}</p>}
                      <p className="text-[11px] text-neutral-500 mt-1">{a.created_at ? parseServerDate(a.created_at).toLocaleString() : ''}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}

        {/* My shifts */}
        {activeTab === 'shifts' && (
          <div>
            <div className="page-header">
              <div>
                <h1 className="page-title">My shifts</h1>
                <p className="page-subtitle">Shifts assigned to you for this event.</p>
              </div>
            </div>
            {shifts.length === 0 ? (
              <div className="empty">No shifts assigned yet.</div>
            ) : (
              <ul className="panel divide-rows">
                {shifts.map((s) => {
                  const assignmentStatus = (s.assignment_status || s.status || 'ASSIGNED').toUpperCase();
                  return (
                    <li key={s.assignment_id || s.id} className="px-4 py-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[13px] text-slate-700">{s.shift_title || s.title || `Shift #${s.shift_id || s.id}`}</p>
                        <p className="text-xs text-neutral-600 mt-0.5">
                          {[s.shift_date, shiftTime(s), s.zone].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <span className={`text-xs shrink-0 ${ASSIGNMENT_STATUS_TEXT[assignmentStatus] || 'text-neutral-700'}`}>
                        {ASSIGNMENT_STATUS_LABEL[assignmentStatus] || assignmentStatus}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {/* My tasks */}
        {activeTab === 'tasks' && (
          <div>
            <div className="page-header">
              <div>
                <h1 className="page-title">My tasks</h1>
                <p className="page-subtitle">Tasks assigned to you.</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={loadAll} className="btn btn-ghost">Refresh</button>
                <button onClick={() => setShowIssueForm(true)} className="btn btn-secondary">Report issue</button>
              </div>
            </div>

            {issueSuccess && <p className="text-[13px] text-green-700 mb-4">{issueSuccess}</p>}

            {tasks.length === 0 ? (
              <div className="empty">No tasks assigned to you yet.</div>
            ) : (
              <ul className="panel divide-rows">
                {tasks.map((task) => (
                  <li key={task.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13px] text-slate-700">{task.title}</p>
                      <p className="text-xs text-neutral-600 mt-0.5">
                        <span className={PRIORITY_COLORS[task.priority] || ''}>
                          {(task.priority || 'MEDIUM').charAt(0) + (task.priority || 'MEDIUM').slice(1).toLowerCase()}
                        </span>
                        {task.zone && <> · {task.zone}</>}
                        {' · '}{TASK_STATUS_LABEL[task.status] || task.status}
                      </p>
                      {task.description && <p className="text-xs text-neutral-700 mt-1">{task.description}</p>}
                    </div>
                    {task.status === 'OPEN' && (
                      <button onClick={() => handleUpdateTaskStatus(task.id, 'IN_PROGRESS')} className="btn btn-secondary btn-sm shrink-0 self-start">
                        Start
                      </button>
                    )}
                    {task.status === 'IN_PROGRESS' && (
                      <button onClick={() => handleUpdateTaskStatus(task.id, 'RESOLVED')} className="btn btn-secondary btn-sm shrink-0 self-start">
                        Mark resolved
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {showIssueForm && (
              <Modal title="Report an issue" subtitle="A coordinator will be notified." onClose={() => setShowIssueForm(false)}>
                <form onSubmit={handleSubmitIssue} className="space-y-4 pb-1">
                  <div>
                    <label className="label">What happened?</label>
                    <input
                      type="text"
                      value={issueForm.title}
                      onChange={e => setIssueForm(f => ({ ...f, title: e.target.value }))}
                      required
                      className="input"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Type</label>
                      <select value={issueForm.issue_type} onChange={e => setIssueForm(f => ({ ...f, issue_type: e.target.value }))} className="input">
                        {ISSUE_TYPES.map(t => (
                          <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase().replace('_', ' ')}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">Zone</label>
                      <input
                        type="text"
                        list="volunteer-zone-options"
                        value={issueForm.zone}
                        onChange={e => setIssueForm(f => ({ ...f, zone: e.target.value }))}
                        placeholder="Where is it?"
                        className="input"
                      />
                      <datalist id="volunteer-zone-options">
                        {zoneOptions.map(z => <option key={z} value={z} />)}
                      </datalist>
                    </div>
                  </div>
                  <div>
                    <label className="label">Details <span className="text-neutral-500">(optional)</span></label>
                    <textarea
                      value={issueForm.description}
                      onChange={e => setIssueForm(f => ({ ...f, description: e.target.value }))}
                      rows={2}
                      className="input resize-none"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setShowIssueForm(false)} className="btn btn-ghost">Cancel</button>
                    <button type="submit" disabled={issueSubmitting} className="btn btn-primary">
                      {issueSubmitting ? 'Sending…' : 'Report issue'}
                    </button>
                  </div>
                </form>
              </Modal>
            )}
          </div>
        )}

        {/* Profile */}
        {activeTab === 'profile' && profile && (
          <div>
            <div className="page-header">
              <div>
                <h1 className="page-title">Profile</h1>
              </div>
            </div>

            <dl className="divide-rows border-y-2 border-white/60">
              {[
                ['Name', profile.full_name],
                ['Email', profile.email],
                ['Phone', profile.phone || '—'],
                ['Emergency contact', profile.emergency_contact || '—'],
                ['Preferred zone', profile.preferences || '—'],
                ['Skills', profile.skills || '—'],
                ['Availability', profile.availability_slots?.length
                  ? profile.availability_slots.map((slot) => `${slot.day_of_week} ${slot.start_time}–${slot.end_time}`).join(', ')
                  : 'Any time'],
                ['Hours worked', `${(profile.total_hours_worked || 0).toFixed(1)}h`],
                ['Shift history', `${profile.completed_shifts || 0} completed · ${profile.no_shows || 0} no-shows`],
              ].map(([label, value]) => (
                <div key={label} className="grid grid-cols-1 sm:grid-cols-[10rem_1fr] gap-1 sm:gap-4 py-3 text-[13px]">
                  <dt className="text-neutral-600">{label}</dt>
                  <dd className="text-slate-700">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

      </main>
    </div>
  );
}
