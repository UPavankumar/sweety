import React from 'react';
import { useAuth } from '../context/AuthContext';
import { DropletIcon, ClipboardIcon, BarChartIcon, LogOutIcon } from './Icons';

export default function Navbar({ activeTab, setActiveTab }) {
  const { user, logout } = useAuth();
  const initials = user?.name ? user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() : 'PT';

  return (
    <header className="header-nav">
      <div className="header-inner">
        <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
          <a href="#" className="brand-badge">
            <div className="brand-icon-wrap">
              <DropletIcon size={18} />
            </div>
            <div>
              <div className="brand-title">Sweety</div>
              <div className="brand-subtitle">Clinical Glucose Ledger</div>
            </div>
          </a>

          {/* Segmented Control Pill Navigation */}
          <nav className="segmented-nav" aria-label="Main Navigation">
            <button
              type="button"
              className={`segmented-btn ${activeTab === 'readings' ? 'active' : ''}`}
              onClick={() => setActiveTab('readings')}
            >
              <ClipboardIcon size={15} />
              <span>Readings Log</span>
            </button>
            <button
              type="button"
              className={`segmented-btn ${activeTab === 'reports' ? 'active' : ''}`}
              onClick={() => setActiveTab('reports')}
            >
              <BarChartIcon size={15} />
              <span>Reports</span>
            </button>
          </nav>
        </div>

        <div className="user-profile-menu">
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>{user?.name}</div>
            <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>{user?.email}</div>
          </div>
          <div className="avatar-chip" title={user?.name}>{initials}</div>
          <button
            type="button"
            className="btn-action btn-neutral-action"
            style={{ height: '34px', padding: '0 12px', fontSize: '0.775rem' }}
            onClick={logout}
            title="Sign out of Sweety"
          >
            <LogOutIcon size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
