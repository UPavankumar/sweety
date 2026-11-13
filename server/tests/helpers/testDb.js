/**
 * Shared test fixtures. Requiring this module first configures the test
 * database (see testEnv.js), then loads the real app and pg pool.
 */
require('./testEnv');

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const request = require('supertest');
const app = require('../../app');
const db = require('../../db');

/**
 * Fixed "today" sent as X-Client-Date on every request, so date rules
 * (no future dates, default report date) don't depend on when the suite runs.
 */
const TODAY = '2025-03-31';
const PASSWORD = 'Password123!';

const api = () => request(app);

/** Drop and recreate all tables from schema.sql (same as migrate.js). */
async function applySchema() {
  const sql = fs.readFileSync(path.join(__dirname, '..', '..', 'schema.sql'), 'utf8');
  await db.pool.query(sql);
}

/** Empty both tables so every test starts from a clean database. */
async function resetDb() {
  await db.query('TRUNCATE readings, users RESTART IDENTITY CASCADE');
}

let userCounter = 0;

/**
 * Create a user directly in the database (same pattern as seed.js: bcrypt,
 * 10 rounds), then log in through the API to get a real token.
 */
async function createUser({ name, email, password = PASSWORD } = {}) {
  userCounter += 1;
  const userEmail = email || `user${userCounter}.${Date.now()}@sweety.test`;
  const userName = name || `Test User ${userCounter}`;
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await db.query(
    'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email',
    [userName, userEmail, hash]
  );
  const res = await api().post('/auth/login').send({ email: userEmail, password });
  if (res.status !== 200) {
    throw new Error(`createUser: login failed with ${res.status} ${JSON.stringify(res.body)}`);
  }
  return { ...rows[0], password, token: res.body.token };
}

/** Authorization + fixed client date headers. */
function authHeaders(token, clientDate = TODAY) {
  const headers = { Authorization: `Bearer ${token}` };
  if (clientDate) headers['X-Client-Date'] = clientDate;
  return headers;
}

/** A valid reading payload; override any field. */
function readingPayload(overrides = {}) {
  return { date: '2025-03-10', slot: 'Morning (fasting)', value: 100, ...overrides };
}

/** POST /readings as a user. */
function postReading(user, overrides = {}, clientDate = TODAY) {
  return api().post('/readings').set(authHeaders(user.token, clientDate)).send(readingPayload(overrides));
}

module.exports = {
  app,
  db,
  api,
  TODAY,
  PASSWORD,
  SLOTS: ['Morning (fasting)', 'After breakfast', 'After lunch', 'After dinner'],
  applySchema,
  resetDb,
  createUser,
  authHeaders,
  readingPayload,
  postReading,
};
