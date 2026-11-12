import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import { PlusCircleIcon, EditIcon, AlertCircleIcon, CheckCircleIcon } from '../Icons';

const SLOTS = [
  'Morning (fasting)',
  'After breakfast',
  'After lunch',
  'After dinner',
];

export default function LogReadingView({
  editingReading,
  onCancelEdit,
  onReadingSaved,
  onViewLedger,
}) {
  const todayStr = new Date().toLocaleDateString('en-CA');

  const [date, setDate] = useState(todayStr);
  const [slot, setSlot] = useState(SLOTS[0]);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (editingReading) {
      setDate(editingReading.date);
      setSlot(editingReading.slot);
      setValue(editingReading.value);
      setError('');
      setSuccessMsg('');
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
    setSuccessMsg('');
    setSubmitting(true);

    try {
      if (editingReading) {
        await api.updateReading(editingReading.id, { date, slot, value });
        setSuccessMsg(`Reading #${editingReading.id} updated successfully.`);
      } else {
        const res = await api.createReading({ date, slot, value });
        setSuccessMsg(`Reading recorded successfully for ${slot} (${value} mg/dL).`);
        setValue('');
      }

      onReadingSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="view-container">
      <div className="section-meta">
        <h1>{editingReading ? `Edit Glucose Log #${editingReading.id}` : 'Log Glucose Reading'}</h1>
        <p>Record clinical blood glucose levels across prescribed meal windows (up to 4 per day).</p>
      </div>

      <div className="intake-layout-split">
        {/* Left: Focused Intake Card */}
        <div className="surface-card" style={{ flex: 1.4 }}>
          <div className="surface-card-header">
            <div className="surface-card-title">
              {editingReading ? <EditIcon size={16} /> : <PlusCircleIcon size={16} />}
              <span>{editingReading ? 'Modify Existing Log' : 'New Intake Entry'}</span>
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

          {/* Success Banner */}
          {successMsg && (
            <div className="clinical-success-banner" role="status">
              <CheckCircleIcon size={18} className="clinical-success-icon" />
              <div style={{ flex: 1 }}>{successMsg}</div>
              <button
                type="button"
                className="btn-action btn-neutral-action"
                style={{ height: '28px', padding: '0 8px', fontSize: '0.725rem' }}
                onClick={onViewLedger}
              >
                View in Ledger →
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div className="input-block">
                <label className="input-label" htmlFor="intake-date">Reading Date</label>
                <input
                  id="intake-date"
                  type="date"
                  className="text-input"
                  max={todayStr}
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
                <span className="input-helper">Date cannot be in the future.</span>
              </div>

              <div className="input-block">
                <label className="input-label" htmlFor="intake-slot">Meal Window Slot</label>
                <select
                  id="intake-slot"
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
                <span className="input-helper">Strictly 1 reading allowed per slot per calendar day.</span>
              </div>

              <div className="input-block">
                <label className="input-label" htmlFor="intake-value">Glucose Level (mg/dL)</label>
                <input
                  id="intake-value"
                  type="number"
                  className="text-input"
                  placeholder="e.g. 115"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
                <span className="input-helper">Whole integer between 40 and 600 mg/dL.</span>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  type="submit"
                  className="btn-action btn-primary-action"
                  style={{ height: '42px', flex: 1 }}
                  disabled={submitting}
                >
                  {submitting
                    ? 'Validating & Saving...'
                    : editingReading
                    ? 'Save Changes'
                    : 'Record Glucose Entry'}
                </button>
                {editingReading && (
                  <button
                    type="button"
                    className="btn-action btn-neutral-action"
                    style={{ height: '42px' }}
                    onClick={onCancelEdit}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>

        {/* Right: Clinical Target Guidelines Side-Card */}
        <div className="surface-card" style={{ flex: 1 }}>
          <div className="surface-card-header">
            <div className="surface-card-title">
              <span>ADA Clinical Targets</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.8125rem' }}>
            <div className="target-guideline-row">
              <span className="target-badge-normal">Fasting / Morning</span>
              <span className="target-range">70 – 99 mg/dL</span>
            </div>
            <div className="target-guideline-row">
              <span className="target-badge-normal">Post-Meal (1-2h)</span>
              <span className="target-range">&lt; 140 mg/dL</span>
            </div>
            <div className="target-guideline-row">
              <span className="target-badge-elevated">Elevated</span>
              <span className="target-range">141 – 199 mg/dL</span>
            </div>
            <div className="target-guideline-row">
              <span className="target-badge-high">High Risk</span>
              <span className="target-range">≥ 200 mg/dL</span>
            </div>
            <div className="target-guideline-row">
              <span className="target-badge-low">Hypoglycemia</span>
              <span className="target-range">&lt; 70 mg/dL</span>
            </div>
          </div>

          <div className="guideline-callout">
            <strong>Intake Rule:</strong> The system enforces a strict 4 readings per day limit (one per meal slot) to ensure compliant diagnostic tracking.
          </div>
        </div>
      </div>
    </div>
  );
}
