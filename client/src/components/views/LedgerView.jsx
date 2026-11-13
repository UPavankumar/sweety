import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../api';
import { EditIcon, TrashIcon, DropletIcon, PlusIcon, AlertCircleIcon } from '../Icons';
import { SlotIcon, StatusBadge, GlucoseValue, PageHeader } from '../ui';
import {
  SLOT_META,
  getGlucoseStatus,
  useThresholds,
  todayISO,
  formatShortDate,
  relativeDayLabel,
} from '../../lib/glucose';

export default function LedgerView({
  allReadings,
  loading,
  dataVersion,
  filterDate,
  setFilterDate,
  onEditReading,
  onReadingDeleted,
  onGoToLogReading,
}) {
  const thresholds = useThresholds();
  const [confirmId, setConfirmId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [actionError, setActionError] = useState('');

  // Server-side date filter (GET /readings?date=)
  const [filtered, setFiltered] = useState(null);
  const [filterLoading, setFilterLoading] = useState(false);
  const [filterError, setFilterError] = useState('');

  useEffect(() => {
    if (!filterDate) {
      setFiltered(null);
      setFilterError('');
      return;
    }
    let cancelled = false;
    setFilterLoading(true);
    api
      .getReadings(filterDate)
      .then((rows) => !cancelled && (setFiltered(rows), setFilterError('')))
      .catch((err) => !cancelled && setFilterError(err.message))
      .finally(() => !cancelled && setFilterLoading(false));
    return () => {
      cancelled = true;
    };
  }, [filterDate, dataVersion]);

  // While a delete confirmation is open: Escape cancels from anywhere, and
  // focus lands on the safe "Keep" button.
  useEffect(() => {
    if (confirmId === null) return undefined;
    const onKey = (e) => e.key === 'Escape' && setConfirmId(null);
    window.addEventListener('keydown', onKey);
    const raf = requestAnimationFrame(() => document.querySelector('.reading-row.confirming .confirm-keep')?.focus());
    return () => {
      window.removeEventListener('keydown', onKey);
      cancelAnimationFrame(raf);
    };
  }, [confirmId]);

  const readings = filterDate ? filtered || [] : allReadings;
  const isLoading = filterDate ? filterLoading && !filtered : loading && allReadings.length === 0;

  // Group by day (API returns newest date first); order slots chronologically within a day
  const groups = useMemo(() => {
    const map = new Map();
    readings.forEach((r) => {
      if (!map.has(r.date)) map.set(r.date, []);
      map.get(r.date).push(r);
    });
    return [...map.entries()].map(([date, rows]) => {
      rows.sort((a, b) => SLOT_META[a.slot].order - SLOT_META[b.slot].order);
      const avg = rows.reduce((s, r) => s + r.value, 0) / rows.length;
      return { date, rows, avg: Math.round(avg * 10) / 10 };
    });
  }, [readings]);

  const handleDelete = async (id) => {
    setDeletingId(id);
    setActionError('');
    try {
      await api.deleteReading(id);
      setConfirmId(null);
      onReadingDeleted();
    } catch (err) {
      setActionError(`Couldn't delete reading: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="view-container">
      <PageHeader
        eyebrow="History"
        title="Glucose ledger"
        subtitle="Every reading you've logged, newest first."
        actions={
          <button type="button" className="btn-action btn-primary-action" onClick={onGoToLogReading}>
            <PlusIcon size={15} />
            <span>New reading</span>
          </button>
        }
      />

      <div className="toolbar">
        <div className="toolbar-field">
          <label htmlFor="ledger-filter-date" className="input-label">Filter by date</label>
          <div className="toolbar-row">
            <input
              id="ledger-filter-date"
              type="date"
              className="text-input"
              max={todayISO()}
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
            />
            {filterDate && (
              <button type="button" className="btn-action btn-neutral-action" onClick={() => setFilterDate('')}>
                Reset
              </button>
            )}
          </div>
        </div>
        <div className="toolbar-summary">
          <span className="toolbar-count">{readings.length}</span>
          <span className="muted-meta">
            {readings.length === 1 ? 'reading' : 'readings'}
            {filterDate ? ` on ${formatShortDate(filterDate)}` : ' in total'}
          </span>
        </div>
      </div>

      {(actionError || filterError) && (
        <div className="clinical-alert-banner" role="alert">
          <AlertCircleIcon size={18} className="clinical-alert-icon" />
          <span>{actionError || filterError}</span>
        </div>
      )}

      {isLoading ? (
        <div className="surface-card">
          <div className="skeleton-stack">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton-row" />
            ))}
          </div>
        </div>
      ) : readings.length === 0 ? (
        <div className="surface-card ledger-empty">
          <div className="ledger-empty-icon">
            <DropletIcon size={22} />
          </div>
          <div className="ledger-empty-title">{filterDate ? 'Nothing logged that day' : 'No readings yet'}</div>
          <p className="ledger-empty-desc">
            {filterDate
              ? `No readings recorded for ${filterDate}. Reset the filter or log a new reading.`
              : 'Your ledger is empty. Log your first reading to start tracking.'}
          </p>
          <button type="button" className="btn-action btn-primary-action" style={{ marginTop: 18 }} onClick={onGoToLogReading}>
            <PlusIcon size={14} />
            <span>Log a reading</span>
          </button>
        </div>
      ) : (
        <div className="day-groups">
          {groups.map((g) => (
            <section key={g.date} className="surface-card day-card" aria-label={`Readings for ${g.date}`}>
              <header className="day-card-header">
                <div>
                  <div className="day-card-title">{relativeDayLabel(g.date)}</div>
                  <div className="day-card-date">
                    {formatShortDate(g.date)} · <span className="mono">{g.date}</span>
                  </div>
                </div>
                <div className="day-card-meta">
                  <span className="muted-meta">{g.rows.length}/4 logged</span>
                  <span className="day-avg">
                    avg <strong className="mono">{g.avg}</strong>
                  </span>
                </div>
              </header>

              <ul className="reading-rows">
                {g.rows.map((r) => {
                  const status = getGlucoseStatus(r.value, r.slot, thresholds);
                  const confirming = confirmId === r.id;
                  return (
                    <li key={r.id} className={`reading-row ${confirming ? 'confirming' : ''}`}>
                      <span className="reading-slot">
                        <span className="reading-slot-icon">
                          <SlotIcon slot={r.slot} size={16} />
                        </span>
                        <span>{r.slot}</span>
                      </span>
                      <GlucoseValue value={r.value} status={status} />
                      <span className="reading-status">
                        <StatusBadge status={status} />
                      </span>
                      <span className="reading-actions">
                        {confirming ? (
                          // Distinct keys so React never reuses the trash button's DOM node
                          // for "Delete" (a double-click on the trash icon must not delete).
                          <span
                            key="confirm"
                            className="confirm-group"
                            role="group"
                            aria-label={`Confirm deleting ${r.slot} reading`}
                          >
                            <span className="confirm-text">Delete?</span>
                            <button
                              type="button"
                              className="btn-action btn-danger-solid btn-sm"
                              disabled={deletingId === r.id}
                              onClick={() => handleDelete(r.id)}
                            >
                              {deletingId === r.id ? 'Deleting…' : 'Delete'}
                            </button>
                            <button
                              type="button"
                              className="btn-action btn-neutral-action btn-sm confirm-keep"
                              onClick={() => setConfirmId(null)}
                            >
                              Keep
                            </button>
                          </span>
                        ) : (
                          <span key="actions" className="confirm-group">
                            <button
                              type="button"
                              className="icon-btn"
                              onClick={() => onEditReading(r)}
                              title="Edit reading"
                              aria-label={`Edit ${r.slot} reading on ${r.date}`}
                            >
                              <EditIcon size={15} />
                            </button>
                            <button
                              type="button"
                              className="icon-btn icon-btn-danger"
                              onClick={() => setConfirmId(r.id)}
                              title="Delete reading"
                              aria-label={`Delete ${r.slot} reading on ${r.date}`}
                            >
                              <TrashIcon size={15} />
                            </button>
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
