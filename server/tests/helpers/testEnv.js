/**
 * Points the app at the TEST database. Must be required before ../../app or
 * ../../db (db.js loads server/.env with dotenv, which never overrides
 * variables that are already set, so the values set here win).
 *
 * The test database URL comes from TEST_DATABASE_URL (e.g. set in CI) or from
 * server/.env.test.local (git-ignored). As a safety net, the suite refuses to
 * run against a database whose name doesn't contain "test" or that matches
 * the dev DATABASE_URL in server/.env, because the tests drop and truncate
 * tables.
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const SERVER_DIR = path.resolve(__dirname, '..', '..');

function readEnvFile(name) {
  const file = path.join(SERVER_DIR, name);
  return fs.existsSync(file) ? dotenv.parse(fs.readFileSync(file)) : {};
}

const devEnv = readEnvFile('.env');
const testEnv = readEnvFile('.env.test.local');
const testUrl = process.env.TEST_DATABASE_URL || testEnv.TEST_DATABASE_URL;

if (!testUrl) {
  throw new Error(
    'No test database configured. Set TEST_DATABASE_URL, or create server/.env.test.local with\n' +
      '  TEST_DATABASE_URL=postgresql://user:pass@host/sweety_test?sslmode=verify-full\n' +
      'The suite drops and recreates tables, so never use the dev database.'
  );
}

const dbName = decodeURIComponent(new URL(testUrl).pathname.replace(/^\//, ''));
if (!/test/i.test(dbName)) {
  throw new Error(`Refusing to run tests against database "${dbName}": its name must contain "test".`);
}
if (devEnv.DATABASE_URL && devEnv.DATABASE_URL === testUrl) {
  throw new Error('Refusing to run tests: TEST_DATABASE_URL is the same as the dev DATABASE_URL.');
}

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = testUrl;
// Use the configured secret if present, otherwise a throwaway one for tests (e.g. CI without server/.env)
process.env.JWT_SECRET = process.env.JWT_SECRET || devEnv.JWT_SECRET || 'test-only-secret-at-least-32-characters-long';

module.exports = { dbName };
