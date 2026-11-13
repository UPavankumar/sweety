const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { loginLimiter, registerLimiter } = require('../middleware/security');

const SALT_ROUNDS = 10;
const TOKEN_EXPIRY = '24h'; // Decision 1A: 24 hours validity
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /auth/register
 * Register a new user with name, email, and password.
 */
router.post('/register', registerLimiter, async (req, res, next) => {
  try {
    const { name, email, password } = req.body || {};

    // 1. Validate required fields
    if (
      typeof name !== 'string' || !name.trim() ||
      typeof email !== 'string' || !email.trim() ||
      typeof password !== 'string' || !password
    ) {
      return res.status(400).json({ error: 'Please provide name, email, and password.' });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();

    if (!EMAIL_RE.test(trimmedEmail) || trimmedEmail.length > 254) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    if (trimmedName.length > 100) {
      return res.status(400).json({ error: 'Name must be 100 characters or fewer.' });
    }

    if (password.length > 128) {
      return res.status(400).json({ error: 'Password must be 128 characters or fewer.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    // 2. Check if user already exists (Decision 3A: 409 Conflict)
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [trimmedEmail]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email is already registered.' });
    }

    // 3. Hash password with bcrypt
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // 4. Insert new user into database
    const insertRes = await db.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, created_at`,
      [trimmedName, trimmedEmail, passwordHash]
    );

    const user = insertRes.rows[0];

    // 5. Generate signed JWT token (Decision 1A & 5A)
    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY, algorithm: 'HS256' }
    );

    return res.status(201).json({
      message: 'Registration successful.',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    // Two simultaneous sign-ups with the same email: the UNIQUE constraint wins
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Email is already registered.' });
    }
    next(error);
  }
});

/**
 * POST /auth/login
 * Authenticate existing user and return JWT token.
 */
router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body || {};

    // 1. Validate presence of credentials
    if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
      return res.status(400).json({ error: 'Please enter both email and password.' });
    }

    const trimmedEmail = email.trim().toLowerCase();

    // 2. Lookup user by email
    const userRes = await db.query(
      `SELECT id, name, email, password_hash
       FROM users
       WHERE email = $1`,
      [trimmedEmail]
    );

    // Decision 2B: Specific error message for missing user
    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'Email not found.' });
    }

    const user = userRes.rows[0];

    // 3. Compare password with bcrypt hash
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      // Decision 2B: Specific error message for incorrect password
      return res.status(401).json({ error: 'Incorrect password.' });
    }

    // 4. Generate signed JWT token (Decision 1A & 5A)
    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY, algorithm: 'HS256' }
    );

    return res.status(200).json({
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
