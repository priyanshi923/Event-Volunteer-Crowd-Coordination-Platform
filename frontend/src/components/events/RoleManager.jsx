import React, { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { eventService } from '../../services/api';
import { errorMessage } from '../../services/useRequest';

const EMPTY_ROLE = { name: '', required_skill: '', needed_count: '1' };

function RoleFields({ value, onChange }) {
  const set = (field) => (e) => onChange({ ...value, [field]: e.target.value });
  return (
    <div className="grid grid-cols-[1fr_1fr_4.5rem] gap-2">
      <input value={value.name} onChange={set('name')} placeholder="Role name" aria-label="Role name" className="input input-sm" />
      <input
        value={value.required_skill}
        onChange={set('required_skill')}
        placeholder="Required skill"
        aria-label="Required skill"
        list="role-skill-options"
        className="input input-sm"
      />
      <input
        type="number"
        min="0"
        value={value.needed_count}
        onChange={set('needed_count')}
        aria-label="Volunteers needed"
        title="Volunteers needed"
        className="input input-sm"
      />
    </div>
  );
}

const toPayload = (role) => ({
  name: role.name.trim(),
  required_skill: role.required_skill.trim(),
  needed_count: Math.max(0, parseInt(role.needed_count, 10) || 0),
});

export default function RoleManager({ eventId, roles, skills, onChange }) {
  const [draft, setDraft] = useState(EMPTY_ROLE);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(EMPTY_ROLE);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async (action) => {
    setBusy(true);
    setError('');
    try {
      await action();
      await onChange();
      return true;
    } catch (err) {
      setError(errorMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const addRole = async (e) => {
    e.preventDefault();
    if (!draft.name.trim()) return;
    if (await run(() => eventService.createRole({ event_id: eventId, ...toPayload(draft) }))) setDraft(EMPTY_ROLE);
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    if (!editDraft.name.trim()) return;
    if (await run(() => eventService.updateRole(editingId, toPayload(editDraft)))) setEditingId(null);
  };

  return (
    <section>
      <h2 className="section-title mb-2">Roles</h2>
      <datalist id="role-skill-options">
        {skills.map((s) => <option key={s} value={s} />)}
      </datalist>
      {roles.length === 0 ? (
        <p className="text-[13px] text-neutral-600 mb-3">No roles yet. Define the jobs volunteers will do.</p>
      ) : (
        <ul className="divide-rows mb-3">
          {roles.map((role) => (
            <li key={role.id} className="py-2">
              {editingId === role.id ? (
                <form onSubmit={saveEdit} className="space-y-2">
                  <RoleFields value={editDraft} onChange={setEditDraft} />
                  <div className="flex gap-1 justify-end">
                    <button type="submit" disabled={busy} className="btn btn-secondary btn-sm">Save</button>
                    <button type="button" onClick={() => setEditingId(null)} className="btn btn-ghost btn-sm">Cancel</button>
                  </div>
                </form>
              ) : confirmDeleteId === role.id ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] text-neutral-800">Delete “{role.name}”? Shifts keep running without the role.</span>
                  <span className="flex gap-1 shrink-0">
                    <button
                      disabled={busy}
                      onClick={() => run(() => eventService.deleteRole(role.id)).then(() => setConfirmDeleteId(null))}
                      className="btn btn-danger btn-sm"
                    >
                      Delete
                    </button>
                    <button onClick={() => setConfirmDeleteId(null)} className="btn btn-ghost btn-sm">Keep</button>
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[13px] text-slate-700">{role.name}</p>
                    <p className="text-xs text-neutral-600">
                      {role.required_skill || 'No required skill'} · {role.needed_count} needed
                    </p>
                  </div>
                  <span className="flex gap-0.5 shrink-0">
                    <button
                      onClick={() => {
                        setEditingId(role.id);
                        setEditDraft({ name: role.name, required_skill: role.required_skill || '', needed_count: String(role.needed_count ?? 0) });
                        setConfirmDeleteId(null);
                      }}
                      title="Edit role"
                      className="btn btn-ghost w-7 h-7 px-0"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => { setConfirmDeleteId(role.id); setEditingId(null); }}
                      title="Delete role"
                      className="btn btn-ghost w-7 h-7 px-0 hover:text-red-700"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={addRole} className="space-y-2">
        <RoleFields value={draft} onChange={(v) => { setDraft(v); setError(''); }} />
        <div className="flex justify-end">
          <button type="submit" disabled={busy || !draft.name.trim()} className="btn btn-secondary btn-sm">Add role</button>
        </div>
      </form>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </section>
  );
}
