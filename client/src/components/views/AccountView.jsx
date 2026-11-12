import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserIcon, ShieldCheckIcon, ActivityIcon, LogOutIcon } from '../Icons';

export default function AccountView({ totalReadings = 0 }) {
  const { user, logout } = useAuth();
  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'PT';

  return (
    <div className="view-container">
      <div className="section-meta">
        <h1>Patient Account Profile</h1>
        <p>Personal profile, security credentials, and health telemetry overview.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* Profile Card */}
        <div className="surface-card">
          <div className="surface-card-header">
            <div className="surface-card-title">
              <UserIcon size={16} />
              <span>Identity & Medical ID</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'var(--brand-light)',
                color: 'var(--brand)',
                fontSize: '1.25rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid #bae6fd',
              }}
            >
              {initials}
            </div>
            <div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{user?.name}</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{user?.email}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--brand)', fontWeight: 600, marginTop: '2px' }}>
                Patient ID: #{user?.id || 1}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.8125rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid var(--border-light)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Account Status</span>
              <span style={{ fontWeight: 600, color: 'var(--status-normal)' }}>● Active Patient</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid var(--border-light)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Database Tenant</span>
              <span style={{ fontWeight: 600 }}>PostgreSQL (Scoped by User ID)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid var(--border-light)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Authentication Model</span>
              <span style={{ fontWeight: 600 }}>JWT Bearer (24h Stateless Session)</span>
            </div>
          </div>

          <button
            type="button"
            className="btn-action btn-neutral-action"
            style={{ width: '100%', marginTop: '20px', height: '38px', color: '#b91c1c' }}
            onClick={logout}
          >
            <LogOutIcon size={14} />
            <span>Sign Out of Patient Account</span>
          </button>
        </div>

        {/* Security & Health Stats Card */}
        <div className="surface-card">
          <div className="surface-card-header">
            <div className="surface-card-title">
              <ShieldCheckIcon size={16} />
              <span>Data Protection & Telemetry</span>
            </div>
          </div>

          <div className="stats-grid" style={{ marginBottom: '20px' }}>
            <div className="clinical-stat-card">
              <span className="stat-header-label">Lifetime Logs</span>
              <div className="stat-numeric-value">{totalReadings}</div>
            </div>
            <div className="clinical-stat-card">
              <span className="stat-header-label">Max Logs / Day</span>
              <div className="stat-numeric-value">4</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.8125rem' }}>
            <div className="guideline-callout" style={{ margin: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#0369a1', marginBottom: '4px' }}>
                <ShieldCheckIcon size={16} />
                <span>Zero-Knowledge Password Security</span>
              </div>
              Your account password is encrypted with 10 rounds of adaptive <strong>bcrypt</strong> salting. Raw passwords are never transmitted or stored in the database.
            </div>

            <div className="guideline-callout" style={{ margin: 0, background: '#f8fafc', borderColor: '#e2e8f0', color: 'var(--text-secondary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                <ActivityIcon size={16} />
                <span>Tenant Isolation Guarantee</span>
              </div>
              All glucose measurements are cryptographically bound to your unique user ID. Other patients on this platform cannot inspect or query your readings.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
