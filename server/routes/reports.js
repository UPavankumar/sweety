const express = require('express');
const router = express.Router();
const db = require('../db');
const authenticateToken = require('../middleware/auth');
const { getTodayDateString } = require('../middleware/validateReading');

// All report endpoints require authentication
router.use(authenticateToken);

const VALID_TYPES = ['daily', 'month-to-date', 'monthly'];

/**
 * GET /reports?type=daily|month-to-date|monthly&date=YYYY-MM-DD
 * Computes highest, lowest, average (rounded to 1 decimal), count, and readings list.
 * Decision 1A: SQL Aggregations
 * Decision 2A: Postgres DATE_TRUNC interval math
 * Decision 3A: Explicit nulls and isEmpty flag
 * Decision 4A: Unified response structure
 * Decision 5A: Smart defaults with strict validation
 */
router.get('/', async (req, res, next) => {
  try {
    const userId = req.user.id;
    let { type, date } = req.query;

    // Decision 5A: Smart Defaults
    if (!type) {
      type = 'daily';
    } else {
      type = type.toLowerCase().trim();
      if (!VALID_TYPES.includes(type)) {
        return res.status(400).json({
          error: `Invalid report type. Allowed types: ${VALID_TYPES.join(', ')}`,
        });
      }
    }

    if (!date) {
      date = getTodayDateString(req);
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        error: 'Please provide a valid date in YYYY-MM-DD format.',
      });
    }

    // Determine SQL date filter and range bounds using Decision 2A (PostgreSQL date arithmetic)
    let dateFilterSql = '';
    let rangeSql = '';

    if (type === 'daily') {
      dateFilterSql = 'date = $2::date';
      rangeSql = `
        SELECT
          TO_CHAR($1::date, 'YYYY-MM-DD') AS start_date,
          TO_CHAR($1::date, 'YYYY-MM-DD') AS end_date
      `;
    } else if (type === 'month-to-date') {
      dateFilterSql = 'date >= DATE_TRUNC(\'month\', $2::date)::date AND date <= $2::date';
      rangeSql = `
        SELECT
          TO_CHAR(DATE_TRUNC('month', $1::date)::date, 'YYYY-MM-DD') AS start_date,
          TO_CHAR($1::date, 'YYYY-MM-DD') AS end_date
      `;
    } else if (type === 'monthly') {
      dateFilterSql = 'date >= DATE_TRUNC(\'month\', $2::date - INTERVAL \'1 month\')::date AND date < DATE_TRUNC(\'month\', $2::date)::date';
      rangeSql = `
        SELECT
          TO_CHAR(DATE_TRUNC('month', $1::date - INTERVAL '1 month')::date, 'YYYY-MM-DD') AS start_date,
          TO_CHAR((DATE_TRUNC('month', $1::date) - INTERVAL '1 day')::date, 'YYYY-MM-DD') AS end_date
      `;
    }

    // 1. Fetch exact date bounds ($1 is date)
    const rangeRes = await db.query(rangeSql, [date]);
    const { start_date, end_date } = rangeRes.rows[0];

    // 2. Compute aggregate stats via PostgreSQL ($1 is userId, $2 is date)
    const statsSql = `
      SELECT
        COUNT(*)::int AS count,
        MAX(value) AS highest,
        MIN(value) AS lowest,
        ROUND(AVG(value)::numeric, 1)::float AS average
      FROM readings
      WHERE user_id = $1 AND ${dateFilterSql}
    `;
    const statsRes = await db.query(statsSql, [userId, date]);
    const rawStats = statsRes.rows[0];

    // 3. Fetch detailed readings list sorted chronologically
    const readingsSql = `
      SELECT
        id,
        user_id,
        TO_CHAR(date, 'YYYY-MM-DD') AS date,
        slot,
        value,
        created_at
      FROM readings
      WHERE user_id = $1 AND ${dateFilterSql}
      ORDER BY
        date ASC,
        CASE slot
          WHEN 'Morning (fasting)' THEN 1
          WHEN 'After breakfast' THEN 2
          WHEN 'After lunch' THEN 3
          WHEN 'After dinner' THEN 4
          ELSE 5
        END,
        id ASC
    `;
    const readingsRes = await db.query(readingsSql, [userId, date]);

    // Decision 3A & 4A: Unified response with explicit nulls and isEmpty flag
    const count = rawStats.count || 0;
    const isEmpty = count === 0;

    return res.status(200).json({
      type,
      selectedDate: date,
      range: {
        startDate: start_date,
        endDate: end_date,
      },
      stats: {
        count,
        highest: isEmpty ? null : rawStats.highest,
        lowest: isEmpty ? null : rawStats.lowest,
        average: isEmpty ? null : rawStats.average,
      },
      isEmpty,
      readings: readingsRes.rows,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
