import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  DropletIcon,
  PlusCircleIcon,
  ClipboardIcon,
  BarChartIcon,
  UserIcon,
  SettingsIcon,
  LogOutIcon,
} from './Icons';

export default function Sidebar({ activeView, setActiveView, readingCount = 0 }) {
  const { user, logout } = useAuth();
  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'PT';

  const navItems = [
    {
      id: 'log-reading',
      label: 'Log Reading',
      icon: PlusCircleIcon,
      badge: 'Intake',
    },
    {
      id: 'ledger',
      label: 'Glucose Ledger',
      icon: ClipboardIcon,
      count: readingCount,
    },
    {
      id: 'reports',
      label: 'Reports & Analytics',
      icon: BarChartIcon,
    },
  ];

  const secondaryNavItems = [
    {
      id: 'account',
      label: 'Patient Account',
      icon: UserIcon,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: SettingsIcon,
    },
  ];

  return (
    <aside className="app-sidebar">
      {/* Brand Header */}
      <div className="sidebar-brand">
        <div className="sidebar-logo-icon">
          <DropletIcon size={18} />
        </div>
        <div>
          <div className="sidebar-brand-name">Sweety</div>
          <div className="sidebar-brand-sub">Clinical Tracker</div>
        </div>
      </div>

      {/* Navigation Group 1: Core Clinical Workflow */}
      <div className="sidebar-nav-section">
        <div className="sidebar-section-title">Clinical Modules</div>
        <nav className="sidebar-nav-list" aria-label="Clinical Modules">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setActiveView(item.id)}
              >
                <div className="nav-item-left">
                  <Icon size={17} className="nav-item-icon" />
                  <span>{item.label}</span>
                </div>
                {item.badge && <span className="nav-item-badge">{item.badge}</span>}
                {item.count !== undefined && item.count > 0 && (
                  <span className="nav-item-count">{item.count}</span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Navigation Group 2: Account & Settings */}
      <div className="sidebar-nav-section">
        <div className="sidebar-section-title">System & Preferences</div>
        <nav className="sidebar-nav-list" aria-label="System and Preferences">
          {secondaryNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setActiveView(item.id)}
              >
                <div className="nav-item-left">
                  <Icon size={17} className="nav-item-icon" />
                  <span>{item.label}</span>
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Spacer to push profile to bottom */}
      <div style={{ flex: 1 }} />

      {/* Patient Profile Footer Card */}
      <div className="sidebar-footer">
        <div className="sidebar-user-card">
          <div className="sidebar-avatar">{initials}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name" title={user?.name}>{user?.name}</div>
            <div className="sidebar-user-email" title={user?.email}>{user?.email}</div>
          </div>
          <button
            type="button"
            className="sidebar-logout-btn"
            onClick={logout}
            title="Sign out of Sweety"
          >
            <LogOutIcon size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
