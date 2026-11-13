import React, { useState } from 'react';
import { SettingsIcon, ActivityIcon, CheckCircleIcon, AlertCircleIcon } from '../Icons';
import { PageHeader } from '../ui';
import {
  DEFAULT_THRESHOLDS,
  HIGH_RISK,
  saveThresholds,
  useThresholds,
  validateThresholds,
  todayISO,
} from '../../lib/glucose';

export default function SettingsView() {
  const current = useThresholds();
  const [form, setForm] = useState({
    low: String(current.low),
    fastingMax: String(current.fastingMax),
    postMealMax: String(current.postMealMax),
  });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const update = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setSaved(false);
  };

  const toNumbers = (f) => ({ low: Number(f.low), fastingMax: Number(f.fastingMax), postMealMax: Number(f.postMealMax) });

  const handleSave = (e) => {
    e.preventDefault();
    const next = toNumbers(form);
    const problem = validateThresholds(next);
    if (problem) {
      setError(problem);
      setSaved(false);
      return;
    }
    saveThresholds(next);
    setError('');
    setSaved(true);
  };

  const handleReset = () => {
    saveThresholds(DEFAULT_THRESHOLDS);
    setForm({
      low: String(DEFAULT_THRESHOLDS.low),
      fastingMax: String(DEFAULT_THRESHOLDS.fastingMax),
      postMealMax: String(DEFAULT_THRESHOLDS.postMealMax),
    });
    setError('');
    setSaved(true);
  };

  const timezoneName = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const rows = [
    ['Unit of measure', 'mg/dL'],
    ['Accepted values', '40 – 600 (whole numbers)'],
    ['Readings per day', '4 (one per meal window)'],
    ['High-risk level', `≥ ${HIGH_RISK} mg/dL`],
    ['Your timezone', timezoneName],
    ["Today's date", todayISO()],
  ];

  return (
    <div className="view-container">
      <PageHeader eyebrow="Preferences" title="Settings" subtitle="Personal target ranges used to color-code your readings." />

      <div className="two-col-grid">
        <section className="surface-card" aria-label="Target thresholds">
          <div className="surface-card-header">
            <div className="surface-card-title">
              <SettingsIcon size={16} />
              <span>Target ranges</span>
            </div>
          </div>

          {saved && (
            <div className="clinical-success-banner" role="status">
              <CheckCircleIcon size={16} className="clinical-success-icon" />
              <span>Targets saved. Readings are now classified with these ranges.</span>
            </div>
          )}
          {error && (
            <div className="clinical-alert-banner" role="alert">
              <AlertCircleIcon size={16} className="clinical-alert-icon" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSave} className="intake-form">
            <div className="input-block">
              <label className="input-label" htmlFor="fasting-min">Low threshold (mg/dL)</label>
              <input id="fasting-min" type="number" inputMode="numeric" className="text-input" value={form.low} onChange={update('low')} />
              <span className="input-helper">Readings below this are flagged as low (hypoglycemia).</span>
            </div>
            <div className="input-block">
              <label className="input-label" htmlFor="fasting-max">Fasting upper bound (mg/dL)</label>
              <input id="fasting-max" type="number" inputMode="numeric" className="text-input" value={form.fastingMax} onChange={update('fastingMax')} />
              <span className="input-helper">Typical fasting target: 70–99 mg/dL.</span>
            </div>
            <div className="input-block">
              <label className="input-label" htmlFor="post-meal-max">After-meal upper bound (mg/dL)</label>
              <input id="post-meal-max" type="number" inputMode="numeric" className="text-input" value={form.postMealMax} onChange={update('postMealMax')} />
              <span className="input-helper">1–2 hours after breakfast, lunch or dinner. Typical target: up to 140 mg/dL.</span>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn-action btn-primary-action btn-lg">Save targets</button>
              <button type="button" className="btn-action btn-neutral-action btn-lg" onClick={handleReset}>Reset to defaults</button>
            </div>
            <p className="input-helper">Saved in this browser. Your targets are a personal reference — follow your clinician's advice.</p>
          </form>
        </section>

        <section className="surface-card" aria-label="System information">
          <div className="surface-card-header">
            <div className="surface-card-title">
              <ActivityIcon size={16} />
              <span>How Sweety works</span>
            </div>
          </div>
          <dl className="kv-list">
            {rows.map(([k, v]) => (
              <div key={k} className="kv-row">
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}
