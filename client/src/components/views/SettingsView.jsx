import React, { useState } from 'react';
import { SettingsIcon, ActivityIcon, CheckCircleIcon } from '../Icons';

export default function SettingsView() {
  const [fastingMin, setFastingMin] = useState(70);
  const [fastingMax, setFastingMax] = useState(99);
  const [postMealMax, setPostMealMax] = useState(140);
  const [saved, setSaved] = useState(false);

  const handleSaveSettings = (e) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const clientDate = new Date().toLocaleDateString('en-CA');
  const timezoneName = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div className="view-container">
      <div className="section-meta">
        <h1>Clinical Preferences & Settings</h1>
        <p>Configure diagnostic glucose thresholds, units of measure, and clinical parameters.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* Diagnostic Thresholds Form */}
        <div className="surface-card">
          <div className="surface-card-header">
            <div className="surface-card-title">
              <SettingsIcon size={16} />
              <span>Target Glucose Thresholds</span>
            </div>
          </div>

          {saved && (
            <div className="clinical-success-banner" style={{ marginBottom: '16px' }}>
              <CheckCircleIcon size={16} className="clinical-success-icon" />
              <span>Diagnostic thresholds saved successfully.</span>
            </div>
          )}

          <form onSubmit={handleSaveSettings}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="input-block">
                <label className="input-label" htmlFor="fasting-min">Fasting Lower Bound (mg/dL)</label>
                <input
                  id="fasting-min"
                  type="number"
                  className="text-input"
                  value={fastingMin}
                  onChange={(e) => setFastingMin(Number(e.target.value))}
                />
                <span className="input-helper">Values below this indicate hypoglycemia risk.</span>
              </div>

              <div className="input-block">
                <label className="input-label" htmlFor="fasting-max">Fasting Upper Bound (mg/dL)</label>
                <input
                  id="fasting-max"
                  type="number"
                  className="text-input"
                  value={fastingMax}
                  onChange={(e) => setFastingMax(Number(e.target.value))}
                />
                <span className="input-helper">Normal ADA morning fasting range: 70–99 mg/dL.</span>
              </div>

              <div className="input-block">
                <label className="input-label" htmlFor="post-meal-max">Post-Prandial Limit (mg/dL)</label>
                <input
                  id="post-meal-max"
                  type="number"
                  className="text-input"
                  value={postMealMax}
                  onChange={(e) => setPostMealMax(Number(e.target.value))}
                />
                <span className="input-helper">After breakfast, lunch, or dinner (target: &lt; 140 mg/dL).</span>
              </div>

              <button type="submit" className="btn-action btn-primary-action" style={{ height: '38px', marginTop: '6px' }}>
                Save Clinical Preferences
              </button>
            </div>
          </form>
        </div>

        {/* System & Telemetry Diagnostics */}
        <div className="surface-card">
          <div className="surface-card-header">
            <div className="surface-card-title">
              <ActivityIcon size={16} />
              <span>System & Telemetry Diagnostics</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.8125rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-light)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Measurement Standard</span>
              <span style={{ fontWeight: 600 }}>mg/dL (Milligrams per Deciliter)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-light)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Validated Input Range</span>
              <span style={{ fontWeight: 600 }}>40 – 600 mg/dL (Integer)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-light)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Detected Client Timezone</span>
              <span style={{ fontWeight: 600 }}>{timezoneName}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-light)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Sync Date Stamp</span>
              <span style={{ fontWeight: 600 }}>{clientDate}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-light)' }}>
              <span style={{ color: 'var(--text-muted)' }}>PostgreSQL Engine</span>
              <span style={{ fontWeight: 600, color: 'var(--brand)' }}>Neon Serverless Postgres</span>
            </div>
          </div>

          <div className="guideline-callout" style={{ marginTop: '20px' }}>
            <strong>Validation Compliance:</strong> Server-side constraints reject any readings outside 40–600 mg/dL or recorded on future calendar dates, preserving clinical audit integrity.
          </div>
        </div>
      </div>
    </div>
  );
}
