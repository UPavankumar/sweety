import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../../api';
import { EditIcon, AlertCircleIcon, CheckCircleIcon, TargetIcon, PlusCircleIcon } from '../Icons';
import { SlotIcon, StatusBadge, GlucoseValue, PageHeader } from '../ui';
import {
  SLOTS,
  SLOT_META,
  HIGH_RISK,
  getGlucoseStatus,
  useThresholds,
  todayISO,
  formatLongDate,
  relativeDayLabel,
} from '../../lib/glucose';

export default function LogReadingView({ readings, ready = true, editingReading, onCancelEdit, onReadingSaved, onViewLedger }) {
  const todayStr = todayISO();
  const thresholds = useThresholds();
  const valueRef = useRef(null);
  const bannerRef = useRef(null);

  const [date, setDate] = useState(todayStr);
  const [slot, setSlot] = useState(SLOTS[0]);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Readings already logged on the selected date (excluding the one being edited)
  const takenOnDate = useMemo(() => {
    const map = {};
    readings
      .filter((r) => r.date === date && r.id !== editingReading?.id)
      .forEach((r) => {
        map[r.slot] = r;
      });
    return map;
  }, [readings, date, editingReading]);

  const firstFreeSlot = (taken) => SLOTS.find((s) => !taken[s]) || SLOTS[0];

  useEffect(() => {
    if (editingReading) {
      setDate(editingReading.date);
      setSlot(editingReading.slot);
      setValue(String(editingReading.value));
      setSuccessMsg('');
    } else {
      setDate(todayStr);
      setValue('');
    }
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingReading]);

  // Keep the selected slot on a free one when the date (or data) changes
  useEffect(() => {
    if (takenOnDate[slot]) setSlot(firstFreeSlot(takenOnDate));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [takenOnDate]);

  // On small screens the Save button is far below the banners: bring feedback into view
  useEffect(() => {
    if ((error || successMsg) && bannerRef.current?.scrollIntoView) {
      bannerRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [error, successMsg]);

  const dayIsFull = SLOTS.every((s) => takenOnDate[s]);
  const numeric = Number(value);
  // Mirror the server rule: plain digits only (no "1e2"), 40–600
  const previewStatus =
    /^\d+$/.test(String(value).trim()) && numeric >= 40 && numeric <= 600
      ? getGlucoseStatus(numeric, slot, thresholds)
      : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      if (editingReading) {
        await api.updateReading(editingReading.id, { date, slot, value });
        setSuccessMsg(`Reading updated — ${slot}, ${value} mg/dL.`);
      } else {
        await api.createReading({ date, slot, value });
        setSuccessMsg(`Saved ${slot} reading of ${value} mg/dL.`);
        setValue('');
      }
      onReadingSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const todays = useMemo(() => {
    const map = {};
    readings.filter((r) => r.date === todayStr).forEach((r) => (map[r.slot] = r));
    return map;
  }, [readings, todayStr]);
  const todayCount = Object.keys(todays).length;

  const pickTodaySlot = (s) => {
    if (editingReading) return;
    setDate(todayStr);
    setSlot(s);
    setError('');
    valueRef.current?.focus();
  };

  return (
    <div className="view-container">
      <PageHeader
        eyebrow={formatLongDate(todayStr)}
        title={editingReading ? 'Edit reading' : 'Log a reading'}
        subtitle={
          editingReading
            ? `Updating the ${editingReading.slot.toLowerCase()} reading from ${editingReading.date}.`
            : 'Record your blood glucose for one of the four daily meal windows.'
        }
      />

      <div className="intake-layout-split">
        {/* Left: Intake form */}
        <section className="surface-card intake-card" aria-label="Reading form">
          <div className="surface-card-header">
            <div className="surface-card-title">
              {editingReading ? <EditIcon size={16} /> : <PlusCircleIcon size={16} />}
              <span>{editingReading ? `Editing reading #${editingReading.id}` : 'New reading'}</span>
            </div>
            {editingReading && (
              <button type="button" className="btn-action btn-neutral-action btn-sm" onClick={onCancelEdit}>
                Cancel edit
              </button>
            )}
          </div>

          <div ref={bannerRef} className="banner-anchor" aria-hidden="true" />
          {error && (
            <div className="clinical-alert-banner" role="alert">
              <AlertCircleIcon size={18} className="clinical-alert-icon" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="clinical-success-banner" role="status">
              <CheckCircleIcon size={18} className="clinical-success-icon" />
              <div className="banner-text">{successMsg}</div>
              <button type="button" className="btn-link" onClick={onViewLedger}>
                View in ledger →
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="intake-form">
            <div className="input-block">
              <label className="input-label" htmlFor="intake-date">Date</label>
              <input
                id="intake-date"
                type="date"
                className="text-input"
                max={todayStr}
                required
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setError('');
                }}
              />
              <span className="input-helper">
                {date ? `${relativeDayLabel(date)} · ` : ''}Future dates aren't allowed.
              </span>
            </div>

            <div className="input-block">
              <span className="input-label" id="slot-label">Meal window</span>
              <div className="slot-picker" role="radiogroup" aria-labelledby="slot-label">
                {SLOTS.map((s) => {
                  const taken = takenOnDate[s];
                  const selected = slot === s && !taken;
                  return (
                    <button
                      key={s}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={taken ? `${s} — already logged (${taken.value} mg/dL)` : s}
                      data-slot={s}
                      disabled={!!taken || !ready}
                      className={`slot-option ${selected ? 'selected' : ''} ${taken ? 'taken' : ''}`}
                      onClick={() => {
                        setSlot(s);
                        setError('');
                      }}
                    >
                      <SlotIcon slot={s} size={18} className="slot-option-icon" />
                      <span className="slot-option-name">{SLOT_META[s].short}</span>
                      <span className="slot-option-sub">{!ready ? 'Loading…' : taken ? `Logged · ${taken.value}` : SLOT_META[s].time}</span>
                    </button>
                  );
                })}
              </div>
              {/* Kept for accessibility tooling & tests that drive a native control */}
              <select
                id="intake-slot"
                className="visually-hidden"
                tabIndex={-1}
                aria-hidden="true"
                value={slot}
                onChange={(e) => setSlot(e.target.value)}
              >
                {SLOTS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <span className="input-helper">One reading per meal window per day — up to 4 a day.</span>
            </div>

            <div className="input-block">
              <label className="input-label" htmlFor="intake-value">Glucose level</label>
              <div className="value-input-wrap">
                <input
                  ref={valueRef}
                  id="intake-value"
                  type="number"
                  inputMode="numeric"
                  className="text-input value-input"
                  placeholder="e.g. 115"
                  value={value}
                  onChange={(e) => {
                    setValue(e.target.value);
                    setError('');
                  }}
                />
                <span className="value-input-unit">mg/dL</span>
              </div>
              <div className="value-preview">
                {previewStatus ? (
                  <>
                    <StatusBadge status={previewStatus} />
                    <span className="input-helper">
                      Target for {SLOT_META[slot].short.toLowerCase()}: {previewStatus.key === 'normal' ? previewStatus.range : `${thresholds.low}–${slot === 'Morning (fasting)' ? thresholds.fastingMax : thresholds.postMealMax}`} mg/dL
                    </span>
                  </>
                ) : (
                  <span className="input-helper">Whole number between 40 and 600.</span>
                )}
              </div>
            </div>

            {dayIsFull && !editingReading ? (
              <div className="info-callout">
                All 4 readings are already logged for {relativeDayLabel(date).toLowerCase() === 'today' ? 'today' : date}. Pick another date or edit an
                existing entry from the ledger.
              </div>
            ) : null}

            <div className="form-actions">
              <button
                type="submit"
                className="btn-action btn-primary-action btn-lg"
                disabled={!ready || submitting || (dayIsFull && !editingReading)}
              >
                {!ready ? 'Loading your readings…' : submitting ? 'Saving…' : editingReading ? 'Save changes' : 'Save reading'}
              </button>
              {editingReading && (
                <button type="button" className="btn-action btn-neutral-action btn-lg" onClick={onCancelEdit}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>

        {/* Right: Today overview + targets */}
        <aside className="intake-side">
          <section className="surface-card" aria-label="Today's readings">
            <div className="surface-card-header">
              <div className="surface-card-title">
                <span>Today</span>
              </div>
              <span className="muted-meta">{todayCount} of 4 logged</span>
            </div>
            <div className="day-progress" aria-hidden="true">
              {SLOTS.map((s) => (
                <span key={s} className={`day-progress-seg ${todays[s] ? `seg-${getGlucoseStatus(todays[s].value, s, thresholds).key}` : ''}`} />
              ))}
            </div>
            <ul className="today-list">
              {SLOTS.map((s) => {
                const r = todays[s];
                const status = r && getGlucoseStatus(r.value, s, thresholds);
                return (
                  <li key={s}>
                    {r ? (
                      <div className="today-row">
                        <span className="today-slot">
                          <SlotIcon slot={s} size={15} />
                          {SLOT_META[s].short}
                        </span>
                        <span className="today-row-right">
                          <GlucoseValue value={r.value} status={status} />
                          <StatusBadge status={status} size="sm" />
                        </span>
                      </div>
                    ) : (
                      <button type="button" className="today-row today-row-empty" onClick={() => pickTodaySlot(s)} disabled={!!editingReading}>
                        <span className="today-slot">
                          <SlotIcon slot={s} size={15} />
                          {SLOT_META[s].short}
                        </span>
                        <span className="today-add">{editingReading ? 'Not logged' : '+ Log now'}</span>
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="surface-card" aria-label="Target ranges">
            <div className="surface-card-header">
              <div className="surface-card-title">
                <TargetIcon size={16} />
                <span>Your targets</span>
              </div>
            </div>
            <dl className="target-list">
              <div className="target-guideline-row">
                <dt><StatusBadge status={{ key: 'normal', label: 'Fasting' }} size="sm" /></dt>
                <dd className="target-range">{thresholds.low}–{thresholds.fastingMax}</dd>
              </div>
              <div className="target-guideline-row">
                <dt><StatusBadge status={{ key: 'normal', label: 'After meals' }} size="sm" /></dt>
                <dd className="target-range">{thresholds.low}–{thresholds.postMealMax}</dd>
              </div>
              <div className="target-guideline-row">
                <dt><StatusBadge status={{ key: 'elevated', label: 'Elevated' }} size="sm" /></dt>
                <dd className="target-range">above target, &lt; {HIGH_RISK}</dd>
              </div>
              <div className="target-guideline-row">
                <dt><StatusBadge status={{ key: 'high', label: 'High' }} size="sm" /></dt>
                <dd className="target-range">≥ {HIGH_RISK}</dd>
              </div>
              <div className="target-guideline-row">
                <dt><StatusBadge status={{ key: 'low', label: 'Low' }} size="sm" /></dt>
                <dd className="target-range">&lt; {thresholds.low}</dd>
              </div>
            </dl>
            <p className="input-helper" style={{ marginTop: 12 }}>All values in mg/dL. Adjust targets in Settings.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
