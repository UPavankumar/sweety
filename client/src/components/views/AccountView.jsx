import React, { useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserIcon, ShieldCheckIcon, LogOutIcon, ActivityIcon } from '../Icons';
import { PageHeader } from '../ui';
import { getGlucoseStatus, useThresholds, initialsOf, formatShortDate } from '../../lib/glucose';

export default function AccountView({ readings = [] }) {
  const { user, logout } = useAuth();
  const thresholds = useThresholds();

  const summary = useMemo(() => {
    const days = new Set(readings.map((r) => r.date));
    const inRange = readings.filter((r) => getGlucoseStatus(r.value, r.slot, thresholds).key === 'normal').length;
    const dates = readings.map((r) => r.date).sort();
    return {
      total: readings.length,
      days: days.size,
      inRangePct: readings.length ? Math.round((inRange / readings.length) * 100) : 0,
      first: dates[0],
      last: dates[dates.length - 1],
    };
  }, [readings, thresholds]);

  return (
    <div className="view-container">
      <PageHeader eyebrow="Account" title="Your profile" subtitle="Account details and a summary of your logging history." />

      <section className="surface-card profile-hero">
        <div className="profile-avatar">{initialsOf(user?.name)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="profile-name">{user?.name}</div>
          <div className="profile-email">{user?.email}</div>
        </div>
        <button type="button" className="btn-action btn-danger-outline" onClick={() => logout()}>
          <LogOutIcon size={15} />
          <span>Sign out</span>
        </button>
      </section>

      <div className="clinical-stats-grid">
        <div className="clinical-stat-card">
          <span className="stat-header-label">Total readings</span>
          <div className="stat-numeric-value">{summary.total}</div>
        </div>
        <div className="clinical-stat-card">
          <span className="stat-header-label">Days logged</span>
          <div className="stat-numeric-value">{summary.days}</div>
        </div>
        <div className="clinical-stat-card">
          <span className="stat-header-label">In target</span>
          <div className="stat-numeric-value">{summary.inRangePct}<span className="stat-numeric-unit">%</span></div>
        </div>
        <div className="clinical-stat-card">
          <span className="stat-header-label">Logging since</span>
          <div className="stat-numeric-value stat-numeric-sm">{summary.first ? formatShortDate(summary.first) : '—'}</div>
        </div>
      </div>

      <div className="two-col-grid">
        <section className="surface-card">
          <div className="surface-card-header">
            <div className="surface-card-title">
              <UserIcon size={16} />
              <span>Account details</span>
            </div>
          </div>
          <dl className="kv-list">
            <div className="kv-row"><dt>Name</dt><dd>{user?.name}</dd></div>
            <div className="kv-row"><dt>Email</dt><dd>{user?.email}</dd></div>
            <div className="kv-row"><dt>Patient ID</dt><dd className="mono">#{user?.id}</dd></div>
            <div className="kv-row"><dt>Last reading</dt><dd>{summary.last || '—'}</dd></div>
          </dl>
        </section>

        <section className="surface-card">
          <div className="surface-card-header">
            <div className="surface-card-title">
              <ShieldCheckIcon size={16} />
              <span>Privacy &amp; security</span>
            </div>
          </div>
          <ul className="feature-list">
            <li>
              <ShieldCheckIcon size={16} />
              <span>Passwords are hashed with bcrypt — never stored in plain text.</span>
            </li>
            <li>
              <ActivityIcon size={16} />
              <span>Your readings are private to your account; other users can't see them.</span>
            </li>
            <li>
              <LogOutIcon size={16} />
              <span>Sessions expire after 24 hours and you'll be asked to sign in again.</span>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
