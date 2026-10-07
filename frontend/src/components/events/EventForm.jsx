import React, { useEffect, useMemo, useState } from 'react';
import Modal from '../Modal';
import { eventService, assetUrl } from '../../services/api';
import { errorMessage } from '../../services/useRequest';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = 'image/jpeg,image/png,image/webp,image/gif';

function splitDateTime(value) {
  const [date = '', time = ''] = String(value || '').split(/[ T]/);
  return { date, time: time.slice(0, 5) };
}

function initialForm(event) {
  const start = splitDateTime(event?.start_date);
  const end = splitDateTime(event?.end_date);
  return {
    name: event?.name || '',
    description: event?.description || '',
    category: event?.category || '',
    location: event?.location || '',
    date: start.date,
    start_time: start.time,
    end_date: end.date && end.date !== start.date ? end.date : '',
    end_time: end.time,
    volunteers_needed: event?.volunteers_needed ? String(event.volunteers_needed) : '',
    is_featured: Boolean(event?.is_featured),
    status: event?.status || 'Upcoming',
  };
}

const joinDateTime = (date, time) => (date ? (time ? `${date} ${time}` : date) : '');

// Create (event = null) or edit an event, including its cover image.
export default function EventForm({ event = null, onClose, onSaved }) {
  const isEdit = Boolean(event);
  const [form, setForm] = useState(() => initialForm(event));
  const [categories, setCategories] = useState([]);
  const [imageFile, setImageFile] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    eventService.getCategories().then((res) => setCategories(res.data || [])).catch(() => {});
  }, []);

  const preview = useMemo(() => (imageFile ? URL.createObjectURL(imageFile) : null), [imageFile]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const currentImage = preview || (!removeImage && event?.image_url ? assetUrl(event.image_url) : '');

  const set = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [field]: value }));
    setError('');
  };

  const handleImage = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!IMAGE_TYPES.split(',').includes(file.type)) {
      setError('Choose a JPEG, PNG, WebP or GIF image.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError('Image must be 5 MB or smaller.');
      return;
    }
    setImageFile(file);
    setRemoveImage(false);
    setError('');
  };

  const validate = () => {
    if (!form.name.trim()) return 'Event name is required.';
    if (!form.date) return 'Choose the event date.';
    const start = joinDateTime(form.date, form.start_time);
    const end = joinDateTime(form.end_date || form.date, form.end_time);
    if (form.end_time && end < start) return 'End must be after start.';
    if (form.volunteers_needed !== '' && (!Number.isInteger(Number(form.volunteers_needed)) || Number(form.volunteers_needed) < 0)) {
      return 'Volunteer requirement must be a whole number.';
    }
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError('');

    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      category: form.category.trim(),
      location: form.location.trim(),
      start_date: joinDateTime(form.date, form.start_time),
      end_date: form.end_time || form.end_date ? joinDateTime(form.end_date || form.date, form.end_time) : '',
      volunteers_needed: form.volunteers_needed === '' ? 0 : Number(form.volunteers_needed),
      is_featured: form.is_featured,
      status: form.status,
    };

    let saved;
    try {
      saved = (isEdit ? await eventService.updateEvent(event.id, payload) : await eventService.createEvent(payload)).data;
    } catch (err) {
      setError(errorMessage(err, 'Could not save the event.'));
      setSaving(false);
      return;
    }

    // The event is saved at this point; an image problem shouldn't lose it.
    let imageError = null;
    try {
      if (imageFile) saved = (await eventService.uploadImage(saved.id, imageFile)).data;
      else if (removeImage && event?.image_url) saved = (await eventService.removeImage(saved.id)).data;
    } catch (err) {
      imageError = errorMessage(err, 'Cover image could not be uploaded.');
    }
    onSaved(saved, { imageError });
  };

  return (
    <Modal size="lg" title={isEdit ? 'Edit event' : 'Create event'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-5 pb-1" noValidate>
        {/* Cover image */}
        <div>
          <span className="label">Cover image <span className="text-neutral-500">(optional)</span></span>
          <div className="flex items-center gap-4">
            <div className="w-32 aspect-video rounded-md overflow-hidden border-2 border-ink bg-white shrink-0">
              {currentImage ? (
                <img src={currentImage} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[11px] text-neutral-500">No image</div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="btn btn-secondary btn-sm cursor-pointer">
                {currentImage ? 'Replace' : 'Upload'}
                <input type="file" accept={IMAGE_TYPES} onChange={handleImage} className="sr-only" />
              </label>
              {currentImage && (
                <button
                  type="button"
                  onClick={() => { setImageFile(null); setRemoveImage(true); }}
                  className="btn btn-ghost btn-sm"
                >
                  Remove
                </button>
              )}
              <p className="w-full text-[11px] text-neutral-500">JPEG, PNG, WebP or GIF, up to 5 MB.</p>
            </div>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="ev-name">Event name</label>
          <input id="ev-name" type="text" required autoFocus value={form.name} onChange={set('name')} className="input" />
        </div>

        <div>
          <label className="label" htmlFor="ev-description">Description</label>
          <textarea id="ev-description" rows="3" value={form.description} onChange={set('description')} className="input" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="ev-category">Category</label>
            <input
              id="ev-category"
              type="text"
              list="ev-category-options"
              value={form.category}
              onChange={set('category')}
              placeholder="e.g. Sports, Conference"
              className="input"
            />
            <datalist id="ev-category-options">
              {categories.map((c) => <option key={c.name} value={c.name} />)}
            </datalist>
          </div>
          <div>
            <label className="label" htmlFor="ev-location">Location</label>
            <input id="ev-location" type="text" value={form.location} onChange={set('location')} className="input" />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="col-span-2 sm:col-span-1">
            <label className="label" htmlFor="ev-date">Date</label>
            <input id="ev-date" type="date" required value={form.date} onChange={set('date')} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="ev-start">Start time</label>
            <input id="ev-start" type="time" value={form.start_time} onChange={set('start_time')} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="ev-end">End time</label>
            <input id="ev-end" type="time" value={form.end_time} onChange={set('end_time')} className="input" />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="label" htmlFor="ev-end-date">Ends on <span className="text-neutral-500">(multi-day)</span></label>
            <input id="ev-end-date" type="date" min={form.date || undefined} value={form.end_date} onChange={set('end_date')} className="input" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="ev-needed">Volunteers needed</label>
            <input
              id="ev-needed"
              type="number"
              min="0"
              step="1"
              value={form.volunteers_needed}
              onChange={set('volunteers_needed')}
              placeholder="From shift headcounts if empty"
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="ev-status">Status</label>
            <select id="ev-status" value={form.status} onChange={set('status')} className="input">
              <option value="Upcoming">Upcoming</option>
              <option value="Active">Active</option>
              <option value="Completed">Completed</option>
            </select>
          </div>
        </div>

        <label className="flex items-center gap-2.5 text-[13px] text-neutral-800 cursor-pointer select-none">
          <input type="checkbox" checked={form.is_featured} onChange={set('is_featured')} className="accent-black w-4 h-4" />
          Feature this event at the top of the Events page
        </label>

        {error && <p role="alert" className="text-[13px] text-red-700">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create event'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
