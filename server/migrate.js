const fs = require('fs');
const path = require('path');
const { pool } = require('./db');

async function migrate() {
  try {
    const sqlPath = path.join(__dirname, 'schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log('Applying schema.sql to database...');
    await pool.query(sql);
    console.log('✓ Tables created successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
