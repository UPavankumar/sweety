const bcrypt = require('bcrypt');
const { pool } = require('./db');

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

    // 4. Sample readings data
    // Includes readings for:
    // - Today: 2026-11-12
    // - Month-to-date (earlier in Nov 2026): 2026-11-01 to 2026-11-10
    // - Previous month (Oct 2026): for monthly report
    const sampleReadings = [
      // Today (2026-11-12)
      { date: '2026-11-12', slot: 'Morning (fasting)', value: 92 },
      { date: '2026-11-12', slot: 'After breakfast', value: 138 },
      { date: '2026-11-12', slot: 'After lunch', value: 124 },
      { date: '2026-11-12', slot: 'After dinner', value: 142 },

      // Earlier this month (Month-to-date)
      { date: '2026-11-10', slot: 'Morning (fasting)', value: 89 },
      { date: '2026-11-10', slot: 'After lunch', value: 118 },
      { date: '2026-11-05', slot: 'Morning (fasting)', value: 95 },
      { date: '2026-11-05', slot: 'After dinner', value: 145 },
      { date: '2026-11-01', slot: 'Morning (fasting)', value: 91 },
      { date: '2026-11-01', slot: 'After breakfast', value: 130 },

      // Previous month (October 2026)
      { date: '2026-10-28', slot: 'Morning (fasting)', value: 88 },
      { date: '2026-10-28', slot: 'After lunch', value: 115 },
      { date: '2026-10-15', slot: 'Morning (fasting)', value: 94 },
      { date: '2026-10-15', slot: 'After breakfast', value: 134 },
      { date: '2026-10-02', slot: 'Morning (fasting)', value: 90 },
      { date: '2026-10-02', slot: 'After dinner', value: 150 },
    ];

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

seed();
