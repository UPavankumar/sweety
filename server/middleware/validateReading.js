const db = require('../db');

const ALLOWED_SLOTS = [
  'Morning (fasting)',
  'After breakfast',
  'After lunch',
  'After dinner',
];

/**
 * True when `str` is a real calendar date in strict YYYY-MM-DD form
 * (rejects things like 2026-02-30 or 2026-13-01 that would crash Postgres).
 */
function isValidDateString(str) {
  if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const [y, m, d] = str.split('-').map(Number);
  if (y < 1900) return false; // also sidesteps Date.UTC mapping years 0-99 to 1900-1999
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

const MAX_PG_INT = 2147483647;

/**
 * Parse a :id route param. Non-numeric -> 400; numeric but beyond the
 * Postgres INTEGER range can't exist -> 404 (instead of a DB overflow 500).
 */
function parseReadingId(raw) {
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) {
    return { status: 400, error: 'Invalid reading ID.' };
  }
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id < 1 || id > MAX_PG_INT) {
    return { status: 404, error: 'Reading not found.' };
  }
  return { id };
}

/**
 * Returns today's date formatted as 'YYYY-MM-DD' in local time (or client header if provided).
 * Prevents UTC false-rejection bugs for timezones ahead of UTC.
 */
function getTodayDateString(req) {
  const clientDate = req && req.headers['x-client-date'];
  if (isValidDateString(clientDate)) {
    // The header is client-controlled: never let it claim a date later than
    // the latest calendar date currently in effect anywhere on Earth (UTC+14),
    // otherwise a spoofed header bypasses the "no future dates" rule.
    const latestOnEarth = new Date(Date.now() + 14 * 3600 * 1000).toISOString().slice(0, 10);
    return clientDate > latestOnEarth ? latestOnEarth : clientDate;
  }
  // 'en-CA' outputs ISO formatted YYYY-MM-DD using local server timezone
  return new Date().toLocaleDateString('en-CA');
}

/**
 * Middleware: Validates glucose reading payloads for POST /readings and PUT /readings/:id
 * Enforces all 5 spec validation rules with exact error messages.
 */
async function validateReading(req, res, next) {
  try {
    const { date, slot, value } = req.body || {};
    let readingId = null;
    if (req.params.id !== undefined) {
      const parsed = parseReadingId(req.params.id);
      if (parsed.error) return res.status(parsed.status).json({ error: parsed.error });
      readingId = parsed.id;
    }
    const userId = req.user.id;

    // 1. Date presence & format check
    if (!isValidDateString(date)) {
      return res.status(400).json({ error: 'Please provide a valid date in YYYY-MM-DD format.' });
    }

    // Rule 5: No future dates
    const today = getTodayDateString(req);
    if (date > today) {
      return res.status(400).json({ error: 'Date cannot be in the future.' });
    }

    // Slot validation
    if (!slot || !ALLOWED_SLOTS.includes(slot)) {
      return res.status(400).json({
        error: `Please select a valid slot. Allowed: ${ALLOWED_SLOTS.join(', ')}`,
      });
    }

    // Rule 1: Value required
    if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
      return res.status(400).json({ error: 'Please enter a glucose value.' });
    }

    // Rule 2: Whole number between 40 and 600. Strings must be plain digits
    // (Number() would otherwise accept "1e2" or "0x64" as 100).
    let numValue = NaN;
    if (typeof value === 'number') numValue = value;
    else if (typeof value === 'string' && /^\s*\d+\s*$/.test(value)) numValue = Number(value);
    if (!Number.isInteger(numValue) || numValue < 40 || numValue > 600) {
      return res.status(400).json({ error: 'Value must be between 40 and 600 mg/dl.' });
    }

    // If updating, verify the reading exists and belongs to the authenticated user
    if (readingId) {
      const existingReading = await db.query(
        'SELECT id, date, slot FROM readings WHERE id = $1 AND user_id = $2',
        [readingId, userId]
      );
      if (existingReading.rows.length === 0) {
        return res.status(404).json({ error: 'Reading not found.' });
      }
    }

    // Rule 3: One reading per slot per day
    let duplicateQuery = 'SELECT id FROM readings WHERE user_id = $1 AND date = $2 AND slot = $3';
    const duplicateParams = [userId, date, slot];

    if (readingId) {
      duplicateQuery += ' AND id != $4';
      duplicateParams.push(readingId);
    }

    const duplicateCheck = await db.query(duplicateQuery, duplicateParams);
    if (duplicateCheck.rows.length > 0) {
      return res.status(400).json({
        error: `You already have a ${slot} reading for this date.`,
      });
    }

    // Rule 4: Max 4 readings per day
    let countQuery = 'SELECT COUNT(*)::int as count FROM readings WHERE user_id = $1 AND date = $2';
    const countParams = [userId, date];

    if (readingId) {
      countQuery += ' AND id != $3';
      countParams.push(readingId);
    }

    const countCheck = await db.query(countQuery, countParams);
    if (countCheck.rows[0].count >= 4) {
      return res.status(400).json({ error: 'You can add only 4 readings per day.' });
    }

    // Store sanitized value as integer on req.body
    req.body.value = numValue;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  validateReading,
  ALLOWED_SLOTS,
  getTodayDateString,
  isValidDateString,
  parseReadingId,
};
