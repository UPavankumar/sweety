import { useSyncExternalStore } from 'react';

export const SLOTS = [
  'Morning (fasting)',
  'After breakfast',
  'After lunch',
  'After dinner',
];

export const SLOT_META = {
  'Morning (fasting)': { short: 'Fasting', time: 'Wake-up', order: 1 },
  'After breakfast': { short: 'Breakfast', time: '1–2h after', order: 2 },
  'After lunch': { short: 'Lunch', time: '1–2h after', order: 3 },
  'After dinner': { short: 'Dinner', time: '1–2h after', order: 4 },
};

export const HIGH_RISK = 200;

/* ---------- Target thresholds (persisted per browser) ---------- */

export const DEFAULT_THRESHOLDS = { low: 70, fastingMax: 99, postMealMax: 140 };

// Targets are stored per account, so people sharing a browser don't share them
let ownerId = null;
let cached = null;
const listeners = new Set();
const storageKey = () => `sweety_thresholds_${ownerId ?? 'anon'}`;

export function setThresholdsOwner(id) {
  if (id === ownerId) return;
  ownerId = id ?? null;
  cached = null;
  listeners.forEach((l) => l());
}

function read() {
  if (cached) return cached;
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey()) || 'null');
    const merged = parsed && typeof parsed === 'object' ? { ...DEFAULT_THRESHOLDS, ...parsed } : DEFAULT_THRESHOLDS;
    // Ignore tampered/corrupt stored values
    cached = validateThresholds(merged) ? DEFAULT_THRESHOLDS : merged;
  } catch {
    cached = DEFAULT_THRESHOLDS;
  }
  return cached;
}

export function validateThresholds({ low, fastingMax, postMealMax }) {
  const all = [low, fastingMax, postMealMax];
  if (all.some((v) => !Number.isInteger(v))) return 'All thresholds must be whole numbers.';
  if (all.some((v) => v < 40 || v > 600)) return 'Thresholds must be between 40 and 600 mg/dL.';
  if (low >= fastingMax) return 'Low threshold must be below the fasting upper bound.';
  if (low >= postMealMax) return 'Low threshold must be below the post-meal limit.';
  if (fastingMax >= HIGH_RISK || postMealMax >= HIGH_RISK) return `Upper bounds must be below ${HIGH_RISK} mg/dL (high-risk level).`;
  return null;
}

export function saveThresholds(next) {
  cached = { ...next };
  try {
    localStorage.setItem(storageKey(), JSON.stringify(cached));
  } catch {
    /* storage unavailable: keep in memory for this session */
  }
  listeners.forEach((l) => l());
}

export function useThresholds() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    read
  );
}

/* ---------- Status classification ---------- */

/**
 * Classify a reading against the patient's targets. Fasting and post-meal
 * readings have different upper bounds, so the slot matters.
 */
export function getGlucoseStatus(value, slot, t = DEFAULT_THRESHOLDS) {
  const v = Number(value);
  const upper = slot === 'Morning (fasting)' ? t.fastingMax : t.postMealMax;
  if (v < t.low) return { key: 'low', label: 'Low', range: `< ${t.low}` };
  if (v <= upper) return { key: 'normal', label: 'In range', range: `${t.low}–${upper}` };
  if (v < HIGH_RISK) return { key: 'elevated', label: 'Elevated', range: `${upper + 1}–${HIGH_RISK - 1}` };
  return { key: 'high', label: 'High', range: `≥ ${HIGH_RISK}` };
}

/* ---------- Date helpers (all local-calendar, YYYY-MM-DD) ---------- */

export function todayISO() {
  return new Date().toLocaleDateString('en-CA');
}

function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatLongDate(iso) {
  return parseISO(iso).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

export function formatShortDate(iso) {
  return parseISO(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatMonth(iso) {
  return parseISO(iso).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export function relativeDayLabel(iso) {
  const today = todayISO();
  if (iso === today) return 'Today';
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (iso === y.toLocaleDateString('en-CA')) return 'Yesterday';
  return parseISO(iso).toLocaleDateString(undefined, { weekday: 'long' });
}

export function initialsOf(name) {
  return name
    ? name
        .trim()
        .split(/\s+/)
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'PT';
}
