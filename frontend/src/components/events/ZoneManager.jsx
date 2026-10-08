import React, { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { eventService } from '../../services/api';
import { errorMessage } from '../../services/useRequest';

export default function ZoneManager({ eventId, zones, usedZones = [], onChange }) {
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
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

  // Zones referenced by shifts but not yet defined for the event
  const defined = new Set(zones.map((z) => z.name.toLowerCase()));
  const undefinedZones = usedZones.filter((z) => !defined.has(z.toLowerCase()));

  const adoptZones = () =>
    run(async () => {
      for (const zoneName of undefinedZones) await eventService.createZone(eventId, { name: zoneName });
    });

  const addZone = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (await run(() => eventService.createZone(eventId, { name: name.trim() }))) setName('');
  };

  const saveEdit = async (zone) => {
    if (!editName.trim() || editName.trim() === zone.name) {
      setEditingId(null);
      return;
    }
    if (await run(() => eventService.updateZone(zone.id, { name: editName.trim(), description: zone.description }))) setEditingId(null);
  };

  return (
    <section>
      <h2 className="section-title mb-2">Zones</h2>
      {zones.length === 0 ? (
        <p className="text-[13px] text-neutral-600 mb-3">No zones yet. Add the areas volunteers will cover.</p>
      ) : (
        <ul className="divide-rows mb-3">
          {zones.map((zone) => (
            <li key={zone.id} className="flex items-center justify-between gap-2 py-2">
              {editingId === zone.id ? (
                <form
                  onSubmit={(e) => { e.preventDefault(); saveEdit(zone); }}
                  className="flex-1 flex items-center gap-2"
                >
                  <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} className="input input-sm" />
                  <button type="submit" disabled={busy} className="btn btn-secondary btn-sm">Save</button>
                  <button type="button" onClick={() => setEditingId(null)} className="btn btn-ghost btn-sm">Cancel</button>
                </form>
              ) : confirmDeleteId === zone.id ? (
                <>
                  <span className="text-[13px] text-neutral-800">Delete “{zone.name}”?</span>
                  <span className="flex gap-1">
                    <button
                      disabled={busy}
                      onClick={() => run(() => eventService.deleteZone(zone.id)).then(() => setConfirmDeleteId(null))}
                      className="btn btn-danger btn-sm"
                    >
                      Delete
                    </button>
                    <button onClick={() => setConfirmDeleteId(null)} className="btn btn-ghost btn-sm">Keep</button>
                  </span>
                </>
              ) : (
                <>
                  <span className="text-[13px] text-slate-700">{zone.name}</span>
                  <span className="flex gap-0.5">
                    <button
                      onClick={() => { setEditingId(zone.id); setEditName(zone.name); setConfirmDeleteId(null); }}
                      title="Rename zone"
                      className="btn btn-ghost w-7 h-7 px-0"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => { setConfirmDeleteId(zone.id); setEditingId(null); }}
                      title="Delete zone"
                      className="btn btn-ghost w-7 h-7 px-0 hover:text-red-700"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {undefinedZones.length > 0 && (
        <p className="mb-3 text-xs text-neutral-600">
          Used by shifts but not defined: {undefinedZones.join(', ')}.{' '}
          <button onClick={adoptZones} disabled={busy} className="font-bold text-slate-700 underline underline-offset-2 hover:bg-brand-yellow">
            Add {undefinedZones.length === 1 ? 'it' : 'them'}
          </button>
        </p>
      )}
      <form onSubmit={addZone} className="flex gap-2">
        <input
          value={name}
          onChange={(e) => { setName(e.target.value); setError(''); }}
          placeholder="New zone name"
          className="input input-sm"
        />
        <button type="submit" disabled={busy || !name.trim()} className="btn btn-secondary h-8">Add</button>
      </form>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </section>
  );
}
