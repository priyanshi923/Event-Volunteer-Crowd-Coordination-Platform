import React, { useState } from 'react';
import { ArrowLeft, Plus, X } from 'lucide-react';
import { volunteerService } from '../services/api';
import { setVolunteerSession } from '../services/session';
import { useZoneNames, useSkills } from '../services/useOptions';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function emptySlot() {
  return { day_of_week: 'Friday', start_time: '08:00', end_time: '17:00' };
}

export default function VolunteerRegistration({ onRegistered, onBack, eventId }) {
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    emergency_contact: '',
    preferences: '',
  });
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [customSkill, setCustomSkill] = useState('');
  const knownSkills = useSkills();
  const zoneOptions = useZoneNames(eventId);
  // Known skills from the platform plus any the volunteer typed in
  const skillChoices = [...knownSkills, ...selectedSkills.filter((s) => !knownSkills.includes(s))];

  const addCustomSkill = () => {
    const skill = customSkill.trim().replace(/,/g, ' ');
    if (!skill) return;
    const existing = skillChoices.find((s) => s.toLowerCase() === skill.toLowerCase());
    const value = existing || skill;
    setSelectedSkills((prev) => (prev.includes(value) ? prev : [...prev, value]));
    setCustomSkill('');
  };
  const [availSlots, setAvailSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setError('');
  };

  const toggleSkill = (skill) => {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const addSlot = () => setAvailSlots((prev) => [...prev, emptySlot()]);

  const updateSlot = (i, field, value) => {
    setAvailSlots((prev) => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s));
  };

  const removeSlot = (i) => {
    setAvailSlots((prev) => prev.filter((_, idx) => idx !== i));
  };

  const validateSlots = () => {
    for (const slot of availSlots) {
      const s = slot.start_time.split(':').map(Number);
      const e = slot.end_time.split(':').map(Number);
      const sMin = s[0] * 60 + s[1];
      const eMin = e[0] * 60 + e[1];
      if (sMin >= eMin) {
        return `Availability slot on ${slot.day_of_week}: start time must be before end time.`;
      }
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.full_name.trim() || !form.email.trim()) {
      setError('Full name and email are required.');
      return;
    }
    const slotErr = validateSlots();
    if (slotErr) { setError(slotErr); return; }

    setLoading(true);
    setError('');
    try {
      const payload = {
        ...form,
        skills: selectedSkills.join(', '),
        notes: '',
      };
      const res = await volunteerService.createVolunteer(payload);
      const volunteerId = res.data.id;

      // Post availability slots
      for (const slot of availSlots) {
        try {
          await volunteerService.addAvailability(volunteerId, slot);
        } catch {
          // Non-fatal; continue
        }
      }

      setVolunteerSession(volunteerId);
      onRegistered(volunteerId);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex justify-center px-4 py-12 sm:py-16">
      <div className="w-full max-w-lg">
        <button type="button" onClick={onBack} className="btn btn-ghost -ml-3 mb-6">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <h1 className="text-xl font-semibold text-slate-700 tracking-tight">Volunteer registration</h1>
        <p className="mt-1 text-neutral-700">Tell coordinators how you can help.</p>

        <form onSubmit={handleSubmit} id="volunteer-registration-form" className="mt-8 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="reg-full-name">Full name</label>
              <input
                id="reg-full-name"
                type="text"
                name="full_name"
                value={form.full_name}
                onChange={handleChange}
                required
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="reg-email">Email</label>
              <input
                id="reg-email"
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="reg-phone">Phone <span className="text-neutral-500">(optional)</span></label>
              <input
                id="reg-phone"
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="reg-emergency">Emergency contact <span className="text-neutral-500">(optional)</span></label>
              <input
                id="reg-emergency"
                type="text"
                name="emergency_contact"
                value={form.emergency_contact}
                onChange={handleChange}
                placeholder="Name and phone"
                className="input"
              />
            </div>
          </div>

          <div>
            <span className="label">Skills</span>
            <div className="flex flex-wrap gap-1.5">
              {skillChoices.map((skill) => {
                const selected = selectedSkills.includes(skill);
                return (
                  <button
                    key={skill}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleSkill(skill)}
                    className={`h-8 px-2.5 rounded-xl text-xs font-bold border-2 border-white/80 transition-[transform,box-shadow] ${
                      selected
                        ? 'bg-brand-yellow shadow-brutal-sm -translate-x-px -translate-y-px'
                        : 'bg-white hover:bg-yellow-100'
                    }`}
                  >
                    {skill}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={customSkill}
                onChange={(e) => setCustomSkill(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomSkill(); } }}
                placeholder={skillChoices.length ? 'Add another skill' : 'e.g. First Aid'}
                aria-label="Add a skill"
                className="input input-sm"
              />
              <button type="button" onClick={addCustomSkill} disabled={!customSkill.trim()} className="btn btn-secondary h-8">
                Add
              </button>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="reg-preferences">Preferred zone <span className="text-neutral-500">(optional)</span></label>
            <input
              id="reg-preferences"
              name="preferences"
              type="text"
              list="reg-zone-options"
              value={form.preferences}
              onChange={handleChange}
              placeholder={zoneOptions.length ? 'Choose a zone' : 'Optional'}
              className="input"
            />
            <datalist id="reg-zone-options">
              {zoneOptions.map((z) => <option key={z} value={z} />)}
            </datalist>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-neutral-700">Availability <span className="text-neutral-500">(optional)</span></span>
              <button type="button" onClick={addSlot} className="btn btn-ghost btn-sm -mr-2">
                <Plus className="w-3.5 h-3.5" /> Add time
              </button>
            </div>
            {availSlots.length === 0 ? (
              <p className="text-xs text-neutral-600">Leave empty if you can work any time.</p>
            ) : (
              <div className="space-y-2">
                {availSlots.map((slot, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <select
                      value={slot.day_of_week}
                      onChange={(e) => updateSlot(i, 'day_of_week', e.target.value)}
                      className="input input-sm flex-1"
                    >
                      {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <input
                      type="time"
                      value={slot.start_time}
                      onChange={(e) => updateSlot(i, 'start_time', e.target.value)}
                      className="input input-sm w-28"
                    />
                    <span className="text-neutral-500">–</span>
                    <input
                      type="time"
                      value={slot.end_time}
                      onChange={(e) => updateSlot(i, 'end_time', e.target.value)}
                      className="input input-sm w-28"
                    />
                    <button type="button" onClick={() => removeSlot(i)} className="btn btn-ghost w-8 px-0" title="Remove">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <p className="text-[13px] text-red-700">{error}</p>}

          <button
            id="volunteer-register-submit"
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full h-9"
          >
            {loading ? 'Registering…' : 'Register'}
          </button>
        </form>
      </div>
    </div>
  );
}
