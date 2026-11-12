import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { PlusIcon, EditIcon, AlertCircleIcon } from './Icons';

const SLOTS = [
  'Morning (fasting)',
  'After breakfast',
  'After lunch',
  'After dinner',
];

export default function ReadingForm({ onReadingSaved, editingReading, onCancelEdit }) {
  const todayStr = new Date().toLocaleDateString('en-CA');

  const [date, setDate] = useState(todayStr);
  const [slot, setSlot] = useState(SLOTS[0]);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (editingReading) {
      setDate(editingReading.date);
      setSlot(editingReading.slot);
      setValue(editingReading.value);
      setError('');
    } else {
      setDate(todayStr);
      setSlot(SLOTS[0]);
      setValue('');
      setError('');
    }
  }, [editingReading]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      if (editingReading) {
        await api.updateReading(editingReading.id, { date, slot, value });
      } else {
        await api.createReading({ date, slot, value });
      }

      if (!editingReading) {
        setValue('');
      }

      onReadingSaved();
    } catch (err) {
      // Display the exact server error message required by spec
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="surface-card">
      <div className="surface-card-header">
        <div className="surface-card-title">
          {editingReading ? <EditIcon size={16} /> : <PlusIcon size={16} />}
          <span>{editingReading ? `Edit Glucose Log #${editingReading.id}` : 'Record Glucose Reading'}</span>
        </div>
        {editingReading && (
          <button
            type="button"
            className="btn-action btn-neutral-action"
            style={{ height: '30px', padding: '0 10px', fontSize: '0.75rem' }}
            onClick={onCancelEdit}
          >
            Cancel Edit
          </button>
        )}
      </div>

      {/* Prominent Exact Validation Alert Banner */}
      {error && (
        <div className="clinical-alert-banner" role="alert">
          <AlertCircleIcon size={18} className="clinical-alert-icon" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="intake-grid">
          <div className="input-block">
            <label className="input-label" htmlFor="reading-date">Log Date</label>
            <input
              id="reading-date"
              type="date"
              className="text-input"
              max={todayStr}
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="input-block">
            <label className="input-label" htmlFor="reading-slot">Meal Slot</label>
            <select
              id="reading-slot"
              className="select-input"
              value={slot}
              onChange={(e) => setSlot(e.target.value)}
            >
              {SLOTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="input-block">
            <label className="input-label" htmlFor="reading-value">Reading (mg/dL)</label>
            <input
              id="reading-value"
              type="number"
              className="text-input"
              placeholder="e.g. 115"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>

          <div>
            <button
              type="submit"
              className="btn-action btn-primary-action"
              style={{ width: '100%', minWidth: '130px' }}
              disabled={submitting}
            >
              {submitting
                ? 'Saving...'
                : editingReading
                ? 'Save Changes'
                : 'Save Reading'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
