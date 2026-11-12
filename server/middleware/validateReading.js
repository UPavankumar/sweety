const db = require('../db');

const ALLOWED_SLOTS = [
  'Morning (fasting)',
  'After breakfast',
  'After lunch',
  'After dinner',
];

/**
 * Returns today's date formatted as 'YYYY-MM-DD' in local time (or client header if provided).
 * Prevents UTC false-rejection bugs for timezones ahead of UTC.
 */
function getTodayDateString(req) {
  if (req && req.headers['x-client-date'] && /^\d{4}-\d{2}-\d{2}$/.test(req.headers['x-client-date'])) {
    return req.headers['x-client-date'];
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
    const { date, slot, value } = req.body;
    const readingId = req.params.id ? parseInt(req.params.id, 10) : null;
    const userId = req.user.id;

    // 1. Date presence & format check
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
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

    // Rule 2: Whole number between 40 and 600
    const numValue = Number(value);
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
};
