const fs = require('fs');
const path = require('path');
const { pool } = require('./db');

/**
 * npm run db:migrate            -> non-destructive: creates tables if missing,
 *                                  then applies constraints.sql (idempotent)
 * npm run db:migrate -- --reset -> DESTRUCTIVE: drops and recreates all tables
 */
async function migrate() {
  const reset = process.argv.includes('--reset');
  try {
    const { rows } = await pool.query("SELECT to_regclass('public.users') AS users");
    const tablesExist = !!rows[0].users;

    if (reset || !tablesExist) {
      if (reset && tablesExist) console.log('⚠ --reset: dropping and recreating ALL tables (all data will be lost)...');
      else console.log('Creating tables from schema.sql...');
      await pool.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
      console.log('✓ Tables created.');
    } else {
      console.log('Tables already exist; keeping data (pass --reset to recreate).');
    }

    await pool.query(fs.readFileSync(path.join(__dirname, 'constraints.sql'), 'utf8'));
    console.log('✓ Constraints applied.');
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

migrate();
