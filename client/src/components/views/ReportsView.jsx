import React, { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from 'react';
import { api } from '../../api';
import { BarChartIcon, AlertCircleIcon, ArrowUpIcon, ArrowDownIcon, HashIcon, ActivityIcon } from '../Icons';
import { SlotIcon, StatusBadge, GlucoseValue, PageHeader } from '../ui';
import {
  SLOTS,
  SLOT_META,
  HIGH_RISK,
  getGlucoseStatus,
  useThresholds,
  todayISO,
  formatShortDate,
  formatLongDate,
  formatMonth,
} from '../../lib/glucose';

const TYPES = [
  { id: 'daily', label: 'Daily' },
  { id: 'month-to-date', label: 'Month to date' },
  { id: 'monthly', label: 'Previous month' },
];

const STATUS_ORDER = ['low', 'normal', 'elevated', 'high'];
const STATUS_LABEL = { low: 'Low', normal: 'In range', elevated: 'Elevated', high: 'High' };

function describeRange(report) {
  const { type, range } = report;
  if (type === 'daily') return formatLongDate(range.startDate);
  if (type === 'monthly') return formatMonth(range.startDate);
  return `${formatShortDate(range.startDate)} – ${formatShortDate(range.endDate)}, ${range.endDate.slice(0, 4)}`;
}

function daysBetween(a, b) {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

/* ---------------- Trend chart (single series, status-coded points) ---------------- */

function TrendChart({ report, thresholds }) {
  const [hover, setHover] = useState(null);
  const wrapRef = useRef(null);
  // Draw in real pixels (viewBox = measured width) so labels stay 11px on phones
  const [W, setW] = useState(720);
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const measure = () => {
      const w = Math.round(el.getBoundingClientRect().width);
      if (w > 0) setW(Math.max(260, w));
    };
    measure(); // synchronous first measurement, before paint
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = W < 480 ? 220 : 260;
  const pad = { l: 40, r: 12, t: 14, b: 30 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;

  const isDaily = report.type === 'daily';
  const totalDays = daysBetween(report.range.startDate, report.range.endDate) + 1;
  const slotsTotal = isDaily ? 4 : totalDays * 4;

  const points = report.readings.map((r) => {
    const dayIdx = isDaily ? 0 : daysBetween(report.range.startDate, r.date);
    const idx = dayIdx * 4 + (SLOT_META[r.slot].order - 1);
    return { ...r, idx, status: getGlucoseStatus(r.value, r.slot, thresholds) };
  });

  const maxVal = Math.max(...points.map((p) => p.value), HIGH_RISK + 20);
  const yMax = Math.ceil(maxVal / 50) * 50;
  const yMin = 0;
  const x = (idx) => pad.l + (slotsTotal === 1 ? iw / 2 : ((idx + 0.5) / slotsTotal) * iw);
  const y = (v) => pad.t + ih - ((v - yMin) / (yMax - yMin)) * ih;

  const yTicks = [];
  for (let v = 0; v <= yMax; v += yMax > 300 ? 100 : 50) yTicks.push(v);

  const xTicks = isDaily
    ? SLOTS.map((s, i) => ({ idx: i, label: SLOT_META[s].short }))
    : (() => {
        // ~70px per label keeps ticks from colliding at any width
        const maxTicks = Math.max(2, Math.floor(iw / 70));
        const step = [1, 2, 3, 5, 7, 10, 14].find((s) => Math.ceil(totalDays / s) <= maxTicks) || 14;
        const ticks = [];
        for (let d = 0; d < totalDays; d += step) {
          const dt = new Date(report.range.startDate + 'T00:00:00');
          dt.setDate(dt.getDate() + d);
          ticks.push({ idx: d * 4 + 1.5, label: dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) });
        }
        return ticks;
      })();

  const bandTop = y(thresholds.postMealMax);
  const bandBottom = y(thresholds.low);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.idx).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');

  // Keep the tooltip inside the card near the left/right edges
  const tipX = hover ? x(hover.idx) : 0;
  const tipAlign = tipX < 90 ? 'left' : tipX > W - 90 ? 'right' : 'center';

  return (
    <div className="chart-wrap" ref={wrapRef} onPointerLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="trend-chart" role="img" aria-label={`Glucose readings over the period, ${points.length} points`}>
        {/* target band */}
        <rect x={pad.l} y={bandTop} width={iw} height={bandBottom - bandTop} className="chart-band" />

        {yTicks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className="chart-grid" />
            <text x={pad.l - 8} y={y(v) + 4} textAnchor="end" className="chart-axis-label">{v}</text>
          </g>
        ))}
        <line x1={pad.l} x2={W - pad.r} y1={y(HIGH_RISK)} y2={y(HIGH_RISK)} className="chart-threshold" />

        {xTicks.map((t) => (
          <text key={t.label + t.idx} x={x(t.idx)} y={H - 8} textAnchor="middle" className="chart-axis-label">{t.label}</text>
        ))}

        {hover && <line x1={x(hover.idx)} x2={x(hover.idx)} y1={pad.t} y2={pad.t + ih} className="chart-crosshair" />}

        {points.length > 1 && <path d={path} className="chart-line" />}
        {points.map((p) => (
          <circle
            key={p.id}
            cx={x(p.idx)}
            cy={y(p.value)}
            r={hover?.id === p.id ? 6.5 : 5}
            className={`chart-point fill-${p.status.key}`}
          />
        ))}
        {/* generous hit targets */}
        {points.map((p) => (
          <rect
            key={`hit-${p.id}`}
            x={x(p.idx) - Math.max(10, iw / slotsTotal / 2)}
            y={pad.t}
            width={Math.max(20, iw / slotsTotal)}
            height={ih}
            fill="transparent"
            className="chart-hit"
            onPointerEnter={() => setHover(p)}
            onPointerDown={() => setHover(p)}
          />
        ))}
      </svg>
      {hover && (
        <div
          className={`chart-tooltip tip-${tipAlign}`}
          style={{ left: tipX, top: y(hover.value) }}
          role="tooltip"
        >
          <div className="chart-tooltip-title">{formatShortDate(hover.date)} · {hover.slot}</div>
          <div className="chart-tooltip-body">
            <strong className="mono">{hover.value}</strong> mg/dL
            <StatusBadge status={hover.status} size="sm" />
          </div>
        </div>
      )}
      <ul className="chart-legend">
        <li><span className="legend-band" aria-hidden="true" />After-meal target {thresholds.low}–{thresholds.postMealMax} (fasting {thresholds.low}–{thresholds.fastingMax})</li>
        <li><span className="legend-dash" aria-hidden="true" />High risk ≥ {HIGH_RISK}</li>
        <li className="muted-meta">Point color = status of that reading</li>
      </ul>
    </div>
  );
}

/* ---------------- View ---------------- */

export default function ReportsView({ dataVersion }) {
  const thresholds = useThresholds();
  const [reportType, setReportType] = useState('daily');
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Only the newest request may update state (fast toggling can resolve out of order)
  const requestSeq = useRef(0);

  const fetchReport = useCallback(async () => {
    if (!selectedDate) return;
    const seq = ++requestSeq.current;
    setLoading(true);
    setError('');
    try {
      const data = await api.getReport(reportType, selectedDate);
      if (seq === requestSeq.current) setReport(data);
    } catch (err) {
      if (seq === requestSeq.current) setError(err.message || 'Could not load the report.');
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [reportType, selectedDate]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport, dataVersion]);

  const distribution = useMemo(() => {
    const counts = { low: 0, normal: 0, elevated: 0, high: 0 };
    report?.readings.forEach((r) => counts[getGlucoseStatus(r.value, r.slot, thresholds).key]++);
    return counts;
  }, [report, thresholds]);

  const total = report?.stats.count || 0;
  const inRangePct = total ? Math.round((distribution.normal / total) * 100) : 0;
  const highestReading = report?.readings.find((r) => r.value === report.stats.highest);
  const lowestReading = report?.readings.find((r) => r.value === report.stats.lowest);

  return (
    <div className="view-container">
      <PageHeader eyebrow="Analytics" title="Reports" subtitle="Highest, lowest and average glucose for a day or a month." />

      <div className="toolbar">
        <div className="toolbar-field">
          <span className="input-label" id="report-type-label">Report type</span>
          <div className="segmented" role="radiogroup" aria-labelledby="report-type-label">
            {TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={reportType === t.id}
                data-type={t.id}
                className={`segmented-option ${reportType === t.id ? 'active' : ''}`}
                onClick={() => setReportType(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="toolbar-field">
          <label className="input-label" htmlFor="report-date">
            Reference date
          </label>
          <input
            id="report-date"
            type="date"
            className="text-input"
            max={todayISO()}
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <div className="clinical-alert-banner" role="alert">
          <AlertCircleIcon size={18} className="clinical-alert-icon" />
          <span style={{ flex: 1 }}>{error}</span>
          <button type="button" className="btn-action btn-neutral-action btn-sm" onClick={fetchReport}>Retry</button>
        </div>
      )}

      {report && (
        <div className={`report-body ${loading ? 'is-loading' : ''}`} aria-busy={loading}>
          <div className="report-range">
            <span className="report-range-label">{TYPES.find((t) => t.id === report.type)?.label}</span>
            <span className="report-range-value">{describeRange(report)}</span>
          </div>

          {report.isEmpty ? (
            <div className="surface-card ledger-empty">
              <div className="ledger-empty-icon"><BarChartIcon size={22} /></div>
              <div className="ledger-empty-title">No readings in this period</div>
              <p className="ledger-empty-desc">
                {report.range.startDate === report.range.endDate
                  ? `Nothing was logged on ${report.range.startDate}.`
                  : `Nothing was logged between ${report.range.startDate} and ${report.range.endDate}.`}{' '}
                Pick another date or report type.
              </p>
            </div>
          ) : (
            <>
              <div className="clinical-stats-grid">
                <div className="clinical-stat-card">
                  <span className="stat-header-label"><ActivityIcon size={14} /> Average</span>
                  <div className="stat-numeric-value">{report.stats.average}<span className="stat-numeric-unit">mg/dL</span></div>
                  <span className="stat-foot">across {total} {total === 1 ? 'reading' : 'readings'}</span>
                </div>
                <div className="clinical-stat-card">
                  <span className="stat-header-label"><ArrowUpIcon size={14} /> Highest</span>
                  <div className="stat-numeric-value">{report.stats.highest}<span className="stat-numeric-unit">mg/dL</span></div>
                  {highestReading && (
                    <span className="stat-foot">
                      <StatusBadge status={getGlucoseStatus(highestReading.value, highestReading.slot, thresholds)} size="sm" />
                      {formatShortDate(highestReading.date)} · {SLOT_META[highestReading.slot].short}
                    </span>
                  )}
                </div>
                <div className="clinical-stat-card">
                  <span className="stat-header-label"><ArrowDownIcon size={14} /> Lowest</span>
                  <div className="stat-numeric-value">{report.stats.lowest}<span className="stat-numeric-unit">mg/dL</span></div>
                  {lowestReading && (
                    <span className="stat-foot">
                      <StatusBadge status={getGlucoseStatus(lowestReading.value, lowestReading.slot, thresholds)} size="sm" />
                      {formatShortDate(lowestReading.date)} · {SLOT_META[lowestReading.slot].short}
                    </span>
                  )}
                </div>
                <div className="clinical-stat-card">
                  <span className="stat-header-label"><HashIcon size={14} /> Readings</span>
                  <div className="stat-numeric-value">{total}</div>
                  <span className="stat-foot">{inRangePct}% in target range</span>
                </div>
              </div>

              <section className="surface-card" aria-label="Time in range">
                <div className="surface-card-header">
                  <div className="surface-card-title">Time in range</div>
                  <span className="muted-meta">{inRangePct}% in target</span>
                </div>
                <div className="tir-bar" role="img" aria-label={STATUS_ORDER.map((k) => `${STATUS_LABEL[k]} ${distribution[k]}`).join(', ')}>
                  {STATUS_ORDER.filter((k) => distribution[k]).map((k) => (
                    <span key={k} className={`tir-seg fill-${k}`} style={{ flexGrow: distribution[k] }} title={`${STATUS_LABEL[k]}: ${distribution[k]}`} />
                  ))}
                </div>
                <ul className="tir-legend">
                  {STATUS_ORDER.map((k) => (
                    <li key={k}>
                      <span className={`legend-swatch fill-${k}`} aria-hidden="true" />
                      <span>{STATUS_LABEL[k]}</span>
                      <strong className="mono">{distribution[k]}</strong>
                      <span className="muted-meta">({total ? Math.round((distribution[k] / total) * 100) : 0}%)</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="surface-card" aria-label="Trend">
                <div className="surface-card-header">
                  <div className="surface-card-title">Trend</div>
                  <span className="muted-meta">Hover or tap a point for details</span>
                </div>
                <TrendChart report={report} thresholds={thresholds} />
              </section>

              <section className="surface-card" aria-label="Readings in this report">
                <div className="surface-card-header">
                  <div className="surface-card-title">Readings</div>
                  <span className="muted-meta">{total} total</span>
                </div>
                <div className="ledger-table-wrap">
                  <table className="ledger-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Meal window</th>
                        <th>Glucose</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.readings.map((r) => {
                        const status = getGlucoseStatus(r.value, r.slot, thresholds);
                        return (
                          <tr key={r.id}>
                            <td className="mono">{r.date}</td>
                            <td>
                              <span className="table-slot"><SlotIcon slot={r.slot} size={14} /> {r.slot}</span>
                            </td>
                            <td><GlucoseValue value={r.value} status={status} /></td>
                            <td><StatusBadge status={status} size="sm" /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </div>
      )}

      {!report && loading && (
        <div className="surface-card">
          <div className="skeleton-stack">
            {[0, 1, 2].map((i) => <div key={i} className="skeleton-row" />)}
          </div>
        </div>
      )}
    </div>
  );
}
