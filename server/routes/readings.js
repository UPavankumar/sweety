const express = require('express');
const router = express.Router();
const db = require('../db');
const authenticateToken = require('../middleware/auth');
const { validateReading, isValidDateString, parseReadingId } = require('../middleware/validateReading');

// Postgres FK violation: the token's user no longer exists
function isMissingUser(error) {
  return error.code === '23503';
}

// All readings routes require an authenticated user
router.use(authenticateToken);

/**
 * GET /readings
 * List all readings for the authenticated user.
 * Optional query parameter: ?date=YYYY-MM-DD
 * Decision 4A: Sorted by date DESC, id DESC (newest first).
 */
router.get('/', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { date } = req.query;

    let queryText = `
      SELECT id, user_id, TO_CHAR(date, 'YYYY-MM-DD') AS date, slot, value, created_at
      FROM readings
      WHERE user_id = $1
    `;
    const queryParams = [userId];

    if (date) {
      if (!isValidDateString(date)) {
        return res.status(400).json({ error: 'Please provide a valid date in YYYY-MM-DD format.' });
      }
      queryText += ' AND date = $2';
      queryParams.push(date);
    }

    queryText += ' ORDER BY date DESC, id DESC';

    const result = await db.query(queryText, queryParams);
    return res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /readings
 * Create a new blood glucose reading.
 * Passes through validateReading middleware (5 validation rules).
 * Decision 3A: Handles PostgreSQL 23505 unique violation fallback.
 */
router.post('/', validateReading, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { date, slot, value } = req.body;

    const result = await db.query(
      `INSERT INTO readings (user_id, date, slot, value)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id, TO_CHAR(date, 'YYYY-MM-DD') AS date, slot, value, created_at`,
      [userId, date, slot, value]
    );

    return res.status(201).json({
      message: 'Reading recorded successfully.',
      reading: result.rows[0],
    });
  } catch (error) {
    // Decision 3A: Handle race condition double-click unique constraint violation
    if (error.code === '23505') {
      return res.status(400).json({
        error: `You already have a ${req.body.slot} reading for this date.`,
      });
    }
    if (isMissingUser(error)) {
      return res.status(401).json({ error: 'Account not found. Please log in again.' });
    }
    next(error);
  }
});

/**
 * PUT /readings/:id
 * Update an existing reading.
 * Decision 5A: Allows updating value, slot, or date with conflict validation.
 */
router.put('/:id', validateReading, async (req, res, next) => {
  try {
    const readingId = parseInt(req.params.id, 10);
    const userId = req.user.id;
    const { date, slot, value } = req.body;

    const result = await db.query(
      `UPDATE readings
       SET date = $1, slot = $2, value = $3
       WHERE id = $4 AND user_id = $5
       RETURNING id, user_id, TO_CHAR(date, 'YYYY-MM-DD') AS date, slot, value, created_at`,
      [date, slot, value, readingId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Reading not found.' });
    }

    return res.status(200).json({
      message: 'Reading updated successfully.',
      reading: result.rows[0],
    });
  } catch (error) {
    // Decision 3A: Postgres 23505 fallback
    if (error.code === '23505') {
      return res.status(400).json({
        error: `You already have a ${req.body.slot} reading for this date.`,
      });
    }
    next(error);
  }
});

/**
 * DELETE /readings/:id
 * Delete a reading belonging to the authenticated user.
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const parsed = parseReadingId(req.params.id);
    if (parsed.error) return res.status(parsed.status).json({ error: parsed.error });
    const readingId = parsed.id;
    const userId = req.user.id;

    const result = await db.query(
      'DELETE FROM readings WHERE id = $1 AND user_id = $2 RETURNING id',
      [readingId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Reading not found.' });
    }

    return res.status(200).json({
      message: 'Reading deleted successfully.',
      id: result.rows[0].id,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
