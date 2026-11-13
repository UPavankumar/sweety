import React from 'react';
import { useAuth } from '../context/AuthContext';
import { DropletIcon, PlusCircleIcon, ClipboardIcon, BarChartIcon, UserIcon, SettingsIcon, LogOutIcon } from './Icons';
import { initialsOf } from '../lib/glucose';

const NAV = [
  { id: 'log-reading', label: 'Log reading', short: 'Log', icon: PlusCircleIcon },
  { id: 'ledger', label: 'Glucose ledger', short: 'Ledger', icon: ClipboardIcon, withCount: true },
  { id: 'reports', label: 'Reports', short: 'Reports', icon: BarChartIcon },
];
const SECONDARY = [
  { id: 'account', label: 'Account', short: 'Account', icon: UserIcon },
  { id: 'settings', label: 'Settings', short: 'Settings', icon: SettingsIcon },
];

export default function Sidebar({ activeView, setActiveView, readingCount = 0 }) {
  const { user, logout } = useAuth();

  const renderItem = (item, count) => {
    const Icon = item.icon;
    const isActive = activeView === item.id;
    return (
      <button
        key={item.id}
        type="button"
        className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
        aria-current={isActive ? 'page' : undefined}
        onClick={() => setActiveView(item.id)}
      >
        <span className="nav-item-left">
          <Icon size={18} className="nav-item-icon" />
          <span className="nav-label-long">{item.label}</span>
          <span className="nav-label-short">{item.short}</span>
        </span>
        {item.withCount && count > 0 && <span className="nav-item-count">{count}</span>}
      </button>
    );
  };

  return (
    <aside className="app-sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo-icon">
          <DropletIcon size={18} />
        </div>
        <div>
          <div className="sidebar-brand-name">Sweety</div>
          <div className="sidebar-brand-sub">Glucose tracker</div>
        </div>
        <button type="button" className="sidebar-logout-btn mobile-only" onClick={() => logout()} title="Sign out" aria-label="Sign out">
          <LogOutIcon size={16} />
        </button>
      </div>

      <nav className="sidebar-nav" aria-label="Main">
        <div className="sidebar-nav-section">
          <div className="sidebar-section-title">Track</div>
          <div className="sidebar-nav-list">{NAV.map((item) => renderItem(item, readingCount))}</div>
        </div>
        <div className="sidebar-nav-section">
          <div className="sidebar-section-title">You</div>
          <div className="sidebar-nav-list">{SECONDARY.map((item) => renderItem(item))}</div>
        </div>
      </nav>

      <div className="sidebar-spacer" />

      <div className="sidebar-footer">
        <div className="sidebar-user-card">
          <div className="sidebar-avatar">{initialsOf(user?.name)}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name" title={user?.name}>{user?.name}</div>
            <div className="sidebar-user-email" title={user?.email}>{user?.email}</div>
          </div>
          <button type="button" className="sidebar-logout-btn" onClick={() => logout()} title="Sign out" aria-label="Sign out">
            <LogOutIcon size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
