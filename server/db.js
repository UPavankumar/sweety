const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env'), quiet: true });

// Cloud databases (Neon) require TLS. Keep certificate verification ON
// (rejectUnauthorized: false would allow man-in-the-middle attacks).
const url = process.env.DATABASE_URL || '';
const isLocal = /localhost|127\.0\.0\.1/.test(url);

const pool = new Pool({
  connectionString: url,
  ssl: isLocal ? false : { rejectUnauthorized: true },
  connectionTimeoutMillis: 10000, // don't hang forever if the DB is unreachable
  idleTimeoutMillis: 30000,
  max: 10,
});

// Serverless Postgres (Neon) routinely drops idle connections. The pool discards
// the broken client on its own, so log and keep serving instead of crashing.
pool.on('error', (err) => {
  console.error('Idle PostgreSQL client error (client discarded):', err.message);
});

// Errors raised while *establishing* a connection: the query was never sent,
// so retrying is safe even for INSERT/UPDATE/DELETE.
const CONNECT_ERRORS = new Set(['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED']);
const MAX_ATTEMPTS = 5; // backoff 250, 500, 1000, 2000 ms -> ~3.75s total window

async function query(text, params, attempt = 1) {
  try {
    return await pool.query(text, params);
  } catch (err) {
    if (CONNECT_ERRORS.has(err.code) && attempt < MAX_ATTEMPTS) {
      console.warn(`DB connect failed (${err.code}), retry ${attempt}/${MAX_ATTEMPTS - 1}`);
      await new Promise((r) => setTimeout(r, 250 * 2 ** (attempt - 1)));
      return query(text, params, attempt + 1);
    }
    throw err;
  }
}

module.exports = {
  query,
  pool,
};
