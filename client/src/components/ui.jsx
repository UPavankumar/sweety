import React from 'react';
import { SunriseIcon, CoffeeIcon, SunIcon, MoonIcon, AlertCircleIcon, CheckIcon, ArrowUpIcon, ArrowDownIcon } from './Icons';

const SLOT_ICONS = {
  'Morning (fasting)': SunriseIcon,
  'After breakfast': CoffeeIcon,
  'After lunch': SunIcon,
  'After dinner': MoonIcon,
};

export function SlotIcon({ slot, size = 16, className = '' }) {
  const Icon = SLOT_ICONS[slot] || SunIcon;
  return <Icon size={size} className={className} />;
}

const STATUS_ICONS = {
  low: ArrowDownIcon,
  normal: CheckIcon,
  elevated: ArrowUpIcon,
  high: AlertCircleIcon,
};

/** Status is never color-only: icon + text label travel with the color. */
export function StatusBadge({ status, size = 'md' }) {
  const Icon = STATUS_ICONS[status.key];
  return (
    <span className={`status-badge status-${status.key} ${size === 'sm' ? 'status-badge-sm' : ''}`}>
      <Icon size={size === 'sm' ? 11 : 12} />
      {status.label}
    </span>
  );
}

export function GlucoseValue({ value, status, large = false }) {
  return (
    <span className={`glucose-value ${large ? 'glucose-value-lg' : ''}`}>
      <span className={`glucose-dot dot-${status.key}`} aria-hidden="true" />
      <span className="glucose-number">{value}</span>
      <span className="glucose-unit">mg/dL</span>
    </span>
  );
}

export function PageHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <div className="page-eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  );
}
