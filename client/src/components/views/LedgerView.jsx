import React, { useState } from 'react';
import { api } from '../../api';
import { CalendarIcon, EditIcon, TrashIcon, DropletIcon, PlusIcon } from '../Icons';

function getGlucoseStatus(value) {
  if (value < 70) {
    return { label: 'Low (<70)', className: 'status-chip-low' };
  }
  if (value <= 140) {
    return { label: 'Normal (70-140)', className: 'status-chip-normal' };
  }
  if (value < 200) {
    return { label: 'Elevated (141-199)', className: 'status-chip-elevated' };
  }
  return { label: 'High (≥200)', className: 'status-chip-high' };
}

export default function LedgerView({
  readings,
  loading,
  filterDate,
  setFilterDate,
  onEditReading,
  onReadingDeleted,
  onGoToLogReading,
}) {
  const [deletingId, setDeletingId] = useState(null);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this glucose reading from your ledger?')) {
      return;
    }

    setDeletingId(id);
    try {
      await api.deleteReading(id);
      onReadingDeleted();
    } catch (err) {
      alert(`Failed to delete reading: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="view-container">
      <div className="section-meta">
        <h1>Patient Glucose Ledger</h1>
        <p>Complete historical log of all diagnostic blood sugar measurements.</p>
      </div>

      <div className="surface-card">
        <div className="surface-card-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
          <div className="surface-card-title">
            <CalendarIcon size={16} />
            <span>Glucose Ledger ({readings.length} records)</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Date Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label htmlFor="ledger-filter-date" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Date Filter:
              </label>
              <input
                id="ledger-filter-date"
                type="date"
                className="text-input"
                style={{ height: '32px', padding: '0 8px', fontSize: '0.775rem' }}
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
              />
              {filterDate && (
                <button
                  type="button"
                  className="btn-action btn-neutral-action"
                  style={{ height: '32px', padding: '0 8px', fontSize: '0.75rem' }}
                  onClick={() => setFilterDate('')}
                >
                  Reset
                </button>
              )}
            </div>

            <button
              type="button"
              className="btn-action btn-primary-action"
              style={{ height: '32px', padding: '0 10px', fontSize: '0.775rem' }}
              onClick={onGoToLogReading}
            >
              <PlusIcon size={14} />
              <span>New Entry</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
            Loading glucose records...
          </div>
        ) : readings.length === 0 ? (
          <div className="ledger-empty">
            <div className="ledger-empty-icon">
              <DropletIcon size={20} />
            </div>
            <div className="ledger-empty-title">No glucose records found</div>
            <p className="ledger-empty-desc">
              {filterDate
                ? `No readings recorded for ${filterDate}. Try resetting the date filter or recording a new reading.`
                : 'Your blood glucose ledger is currently empty. Record your first reading to begin tracking.'}
            </p>
            <button
              type="button"
              className="btn-action btn-primary-action"
              style={{ marginTop: '16px', height: '36px' }}
              onClick={onGoToLogReading}
            >
              <PlusIcon size={14} />
              <span>Record First Reading</span>
            </button>
          </div>
        ) : (
          <div className="ledger-table-wrap">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>Log Date</th>
                  <th>Meal Window Slot</th>
                  <th>Glucose Value</th>
                  <th>Clinical Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {readings.map((r) => {
                  const status = getGlucoseStatus(r.value);
                  return (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.date}</td>
                      <td>
                        <span className="slot-pill">{r.slot}</span>
                      </td>
                      <td>
                        <span className={`glucose-metric-chip ${status.className}`}>
                          {r.value}
                          <span className="glucose-metric-unit">mg/dL</span>
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.775rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                          {status.label}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '4px' }}>
                          <button
                            type="button"
                            className="btn-action btn-secondary-ghost"
                            onClick={() => onEditReading(r)}
                            title="Edit reading"
                          >
                            <EditIcon size={14} />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            className="btn-action btn-danger-ghost"
                            disabled={deletingId === r.id}
                            onClick={() => handleDelete(r.id)}
                            title="Delete reading"
                          >
                            <TrashIcon size={14} />
                            <span>{deletingId === r.id ? '...' : 'Delete'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
