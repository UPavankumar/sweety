const bcrypt = require('bcrypt');
const { pool } = require('./db');

const iso = (y, m, d) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);

/**
 * Demo readings for: today (all 4 slots), earlier this month (only days
 * before today), and the previous month (days that exist in every month).
 */
function buildSampleReadings(now) {
  const y = now.getFullYear();
  const m = now.getMonth();
  const today = now.getDate();
  const rows = [
    { date: iso(y, m, today), slot: 'Morning (fasting)', value: 92 },
    { date: iso(y, m, today), slot: 'After breakfast', value: 138 },
    { date: iso(y, m, today), slot: 'After lunch', value: 124 },
    { date: iso(y, m, today), slot: 'After dinner', value: 142 },
  ];
  const earlier = [
    [1, 'Morning (fasting)', 91], [1, 'After breakfast', 130],
    [5, 'Morning (fasting)', 95], [5, 'After dinner', 145],
    [10, 'Morning (fasting)', 89], [10, 'After lunch', 118],
  ];
  earlier.filter(([d]) => d < today).forEach(([d, slot, value]) => rows.push({ date: iso(y, m, d), slot, value }));
  const prev = [
    [2, 'Morning (fasting)', 90], [2, 'After dinner', 150],
    [15, 'Morning (fasting)', 94], [15, 'After breakfast', 134],
    [28, 'Morning (fasting)', 88], [28, 'After lunch', 115],
  ];
  prev.forEach(([d, slot, value]) => rows.push({ date: iso(y, m - 1, d), slot, value }));
  return rows;
}

async function seed() {
  try {
    console.log('Seeding demo data into Sweety database...');

    // 1. Clean existing demo data to ensure repeatability
    await pool.query("DELETE FROM users WHERE email = 'demo@sweety.com'");

    // 2. Hash demo user password with bcrypt (10 rounds)
    const saltRounds = 10;
    const plainPassword = 'Password123!';
    const passwordHash = await bcrypt.hash(plainPassword, saltRounds);

    // 3. Insert demo user
    const userRes = await pool.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email`,
      ['Demo Patient', 'demo@sweety.com', passwordHash]
    );

    const demoUserId = userRes.rows[0].id;
    console.log(`✓ Demo user created: ${userRes.rows[0].email} (ID: ${demoUserId})`);

    // 4. Sample readings, dated relative to the day the seed runs so the
    //    daily, month-to-date and monthly reports always have data.
    const sampleReadings = buildSampleReadings(new Date());

    for (const r of sampleReadings) {
      await pool.query(
        `INSERT INTO readings (user_id, date, slot, value)
         VALUES ($1, $2, $3, $4)`,
        [demoUserId, r.date, r.slot, r.value]
      );
    }

    console.log(`✓ Seeded ${sampleReadings.length} sample readings successfully!`);
    console.log('\nDemo Credentials:');
    console.log('---------------------------');
    console.log('Email:    demo@sweety.com');
    console.log('Password: Password123!');
    console.log('---------------------------');
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  seed();
}

module.exports = { buildSampleReadings };
