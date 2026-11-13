const { db, api, applySchema, resetDb, createUser, authHeaders, postReading, readingPayload, SLOTS, TODAY } = require('./helpers/testDb');

jest.setTimeout(30000);

beforeAll(applySchema);
beforeEach(resetDb);
afterAll(() => db.pool.end());

const DATE_ERROR = 'Please provide a valid date in YYYY-MM-DD format.';
const VALUE_ERROR = 'Value must be between 40 and 600 mg/dl.';
const SLOT_ERROR = `Please select a valid slot. Allowed: ${SLOTS.join(', ')}`;

describe('POST /readings validation', () => {
  describe('date', () => {
    test.each([
      ['missing', undefined],
      ['empty', ''],
      ['wrong format', '10-03-2025'],
      ['not a date', 'yesterday'],
      ['impossible calendar date', '2025-02-30'],
    ])('%s date -> 400', async (_label, date) => {
      const user = await createUser();
      const res = await postReading(user, { date });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe(DATE_ERROR);
    });

    test('a date after the client date -> 400', async () => {
      const user = await createUser();
      const res = await postReading(user, { date: '2025-04-01' }, '2025-03-31');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Date cannot be in the future.');
    });

    test('the client date itself (today) is accepted', async () => {
      const user = await createUser();
      const res = await postReading(user, { date: TODAY }, TODAY);
      expect(res.status).toBe(201);
    });

    test('without X-Client-Date, a date after the server clock is rejected', async () => {
      const user = await createUser();
      // two days ahead so the test holds in any timezone
      const ahead = new Date(Date.now() + 2 * 86400000).toLocaleDateString('en-CA');
      const res = await postReading(user, { date: ahead }, null);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Date cannot be in the future.');
    });
  });

  describe('slot', () => {
    test.each([
      ['missing', undefined],
      ['unknown', 'Midnight snack'],
      ['wrong case', 'after lunch'],
    ])('%s slot -> 400 listing the allowed slots', async (_label, slot) => {
      const user = await createUser();
      const res = await postReading(user, { slot });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe(SLOT_ERROR);
    });

    test.each(SLOTS)('"%s" is accepted', async (slot) => {
      const user = await createUser();
      const res = await postReading(user, { slot });
      expect(res.status).toBe(201);
      expect(res.body.reading.slot).toBe(slot);
    });
  });

  describe('value', () => {
    test.each([
      ['missing', undefined],
      ['null', null],
      ['empty string', ''],
      ['whitespace', '   '],
    ])('%s value -> 400 "Please enter a glucose value."', async (_label, value) => {
      const user = await createUser();
      const res = await postReading(user, { value });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Please enter a glucose value.');
    });

    test.each([
      ['below range', 39],
      ['above range', 601],
      ['zero', 0],
      ['negative', -100],
      ['decimal', 100.5],
      ['decimal string', '99.9'],
      ['text', 'abc'],
    ])('%s value -> 400', async (_label, value) => {
      const user = await createUser();
      const res = await postReading(user, { value });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe(VALUE_ERROR);
    });

    test.each([
      ['lower bound 40', 40, 40],
      ['upper bound 600', 600, 600],
      ['numeric string', '115', 115],
    ])('%s is accepted and stored as an integer', async (_label, value, stored) => {
      const user = await createUser();
      const res = await postReading(user, { value });
      expect(res.status).toBe(201);
      expect(res.body.reading.value).toBe(stored);
    });
  });

  describe('per-day rules', () => {
    test('a second reading for the same slot and day -> 400', async () => {
      const user = await createUser();
      await postReading(user, { slot: 'After lunch' });
      const res = await postReading(user, { slot: 'After lunch', value: 150 });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('You already have a After lunch reading for this date.');
    });

    test('the same slot on a different day is allowed', async () => {
      const user = await createUser();
      await postReading(user, { slot: 'After lunch', date: '2025-03-10' });
      const res = await postReading(user, { slot: 'After lunch', date: '2025-03-11' });
      expect(res.status).toBe(201);
    });

    test('the same slot and day for a different user is allowed', async () => {
      const a = await createUser();
      const b = await createUser();
      await postReading(a, { slot: 'After lunch' });
      const res = await postReading(b, { slot: 'After lunch' });
      expect(res.status).toBe(201);
    });

    test('all 4 slots can be filled on one day', async () => {
      const user = await createUser();
      for (const slot of SLOTS) {
        const res = await postReading(user, { slot });
        expect(res.status).toBe(201);
      }
      const { rows } = await db.query('SELECT count(*)::int AS n FROM readings WHERE user_id = $1', [user.id]);
      expect(rows[0].n).toBe(4);
    });

    // NOTE (brief vs implementation): the brief expects a 5th reading on a full
    // day to fail with 'You can add only 4 readings per day.'. With exactly 4
    // allowed slots, any 5th reading must reuse a slot, and validateReading.js
    // runs the duplicate-slot check before the 4-per-day check, so the
    // duplicate-slot message is what the API actually returns. The 4-per-day
    // branch is unreachable through the API.
    test('a 5th reading on a full day -> 400 (reported as a duplicate slot)', async () => {
      const user = await createUser();
      for (const slot of SLOTS) await postReading(user, { slot });
      const res = await postReading(user, { slot: 'After dinner', value: 120 });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('You already have a After dinner reading for this date.');
      const { rows } = await db.query('SELECT count(*)::int AS n FROM readings WHERE user_id = $1', [user.id]);
      expect(rows[0].n).toBe(4);
    });

    test('simultaneous submits for the same slot store exactly one reading (UNIQUE constraint)', async () => {
      const user = await createUser();
      const results = await Promise.all(Array.from({ length: 5 }, () => postReading(user, { slot: 'After breakfast' })));
      expect(results.filter((r) => r.status === 201)).toHaveLength(1);
      expect(results.filter((r) => r.status === 400)).toHaveLength(4);
      const { rows } = await db.query('SELECT count(*)::int AS n FROM readings WHERE user_id = $1', [user.id]);
      expect(rows[0].n).toBe(1);
    });
  });

  test('a rejected reading is not stored', async () => {
    const user = await createUser();
    await api().post('/readings').set(authHeaders(user.token)).send(readingPayload({ value: 9999 }));
    const { rows } = await db.query('SELECT count(*)::int AS n FROM readings');
    expect(rows[0].n).toBe(0);
  });
});
