const jwt = require('jsonwebtoken');
const db = require('../db');

/**
 * Authentication Middleware
 * Validates the Authorization Bearer token on protected routes, then confirms
 * the account still exists (a token outlives a deleted account otherwise).
 * Attaches { id, name, email } to req.user.
 */
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const match = typeof authHeader === 'string' && /^Bearer\s+(\S+)$/i.exec(authHeader.trim());

  if (!match) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  let decoded;
  try {
    // Pin the algorithm so a forged header can't pick a weaker one
    decoded = jwt.verify(match[1], process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired. Please log in again.' });
    }
    return res.status(401).json({ error: 'Invalid or malformed token.' });
  }

  if (!Number.isInteger(decoded.id)) {
    return res.status(401).json({ error: 'Invalid or malformed token.' });
  }

  try {
    const result = await db.query('SELECT id, name, email FROM users WHERE id = $1', [decoded.id]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Account not found. Please log in again.' });
    }
    req.user = result.rows[0];
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = authenticateToken;
