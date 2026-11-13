const { db, api, applySchema, resetDb, createUser, authHeaders, TODAY } = require('./helpers/testDb');

jest.setTimeout(30000);

beforeAll(applySchema);
beforeEach(resetDb);
afterAll(() => db.pool.end());

const getReport = (user, query = '', clientDate) =>
  api().get(`/reports${query}`).set(authHeaders(user.token, clientDate));

async function insertReadings(user, rows) {
  for (const [date, slot, value] of rows) {
    await db.query('INSERT INTO readings (user_id, date, slot, value) VALUES ($1, $2, $3, $4)', [user.id, date, slot, value]);
  }
}

/**
 * Fixture spanning a year boundary, two months and the days around a
 * month-to-date reference date of 2025-03-15.
 */
const FIXTURE = [
  ['2025-01-31', 'After lunch', 500], // January: outside the February monthly report
  ['2025-02-01', 'Morning (fasting)', 80],
  ['2025-02-14', 'After lunch', 150],
  ['2025-02-28', 'After dinner', 101],
  ['2025-03-01', 'Morning (fasting)', 90],
  ['2025-03-10', 'After dinner', 200], // inserted out of slot order on purpose
  ['2025-03-10', 'Morning (fasting)', 100],
  ['2025-03-10', 'After lunch', 101],
  ['2025-03-10', 'After breakfast', 101],
  ['2025-03-16', 'After lunch', 300], // after the month-to-date reference date
];

async function userWithFixture() {
  const user = await createUser();
  await insertReadings(user, FIXTURE);
  return user;
}

describe('GET /reports — response shape', () => {
  test('returns type, selectedDate, range, stats, isEmpty and readings', async () => {
    const user = await userWithFixture();
    const res = await getReport(user, '?type=daily&date=2025-03-10');

    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(['isEmpty', 'range', 'readings', 'selectedDate', 'stats', 'type']);
    expect(res.body.type).toBe('daily');
    expect(res.body.selectedDate).toBe('2025-03-10');
    expect(res.body.isEmpty).toBe(false);
    expect(res.body.readings[0]).toMatchObject({ id: expect.any(Number), date: '2025-03-10', slot: expect.any(String), value: expect.any(Number) });
  });
});

describe('daily', () => {
  test('covers only the selected date, with highest/lowest/average', async () => {
    const user = await userWithFixture();
    const { body } = await getReport(user, '?type=daily&date=2025-03-10');

    expect(body.range).toEqual({ startDate: '2025-03-10', endDate: '2025-03-10' });
    expect(body.stats).toEqual({ count: 4, highest: 200, lowest: 100, average: 125.5 });
  });

  test('lists readings in meal order (fasting, breakfast, lunch, dinner)', async () => {
    const user = await userWithFixture();
    const { body } = await getReport(user, '?type=daily&date=2025-03-10');
    expect(body.readings.map((r) => r.slot)).toEqual(['Morning (fasting)', 'After breakfast', 'After lunch', 'After dinner']);
  });

  test('average is rounded to 1 decimal place', async () => {
    const user = await createUser();
    await insertReadings(user, [
      ['2025-03-05', 'Morning (fasting)', 100],
      ['2025-03-05', 'After breakfast', 101],
      ['2025-03-05', 'After lunch', 101],
    ]);
    const { body } = await getReport(user, '?type=daily&date=2025-03-05');
    expect(body.stats.average).toBe(100.7); // 302 / 3 = 100.666…
  });

  test('a single reading: highest = lowest = average', async () => {
    const user = await createUser();
    await insertReadings(user, [['2025-03-05', 'After lunch', 142]]);
    const { body } = await getReport(user, '?type=daily&date=2025-03-05');
    expect(body.stats).toEqual({ count: 1, highest: 142, lowest: 142, average: 142 });
  });
});

describe('month-to-date', () => {
  test('runs from the 1st of the month to the selected date, inclusive', async () => {
    const user = await userWithFixture();
    const { body } = await getReport(user, '?type=month-to-date&date=2025-03-15');

    expect(body.range).toEqual({ startDate: '2025-03-01', endDate: '2025-03-15' });
    // 2025-03-01 (90) + four readings on 2025-03-10; excludes February and 2025-03-16
    expect(body.stats).toEqual({ count: 5, highest: 200, lowest: 90, average: 118.4 });
    expect(body.readings.map((r) => r.date)).toEqual(['2025-03-01', '2025-03-10', '2025-03-10', '2025-03-10', '2025-03-10']);
  });

  test('on the 1st of the month it covers just that day', async () => {
    const user = await userWithFixture();
    const { body } = await getReport(user, '?type=month-to-date&date=2025-03-01');
    expect(body.range).toEqual({ startDate: '2025-03-01', endDate: '2025-03-01' });
    expect(body.stats.count).toBe(1);
  });
});

describe('monthly (previous calendar month)', () => {
  test('covers the whole month before the selected date', async () => {
    const user = await userWithFixture();
    const { body } = await getReport(user, '?type=monthly&date=2025-03-15');

    expect(body.range).toEqual({ startDate: '2025-02-01', endDate: '2025-02-28' });
    expect(body.stats).toEqual({ count: 3, highest: 150, lowest: 80, average: 110.3 });
    expect(body.readings.map((r) => r.date)).toEqual(['2025-02-01', '2025-02-14', '2025-02-28']);
  });

  test('handles leap years', async () => {
    const user = await createUser();
    const { body } = await getReport(user, '?type=monthly&date=2024-03-05');
    expect(body.range).toEqual({ startDate: '2024-02-01', endDate: '2024-02-29' });
  });

  test('crosses the year boundary in January', async () => {
    const user = await createUser();
    await insertReadings(user, [
      ['2024-12-31', 'After dinner', 130],
      ['2025-01-02', 'After dinner', 300],
    ]);
    const { body } = await getReport(user, '?type=monthly&date=2025-01-15');
    expect(body.range).toEqual({ startDate: '2024-12-01', endDate: '2024-12-31' });
    expect(body.stats).toEqual({ count: 1, highest: 130, lowest: 130, average: 130 });
  });
});

describe('empty ranges', () => {
  test.each([
    ['daily', '2025-03-11'],
    ['month-to-date', '2025-04-20'],
    ['monthly', '2025-01-10'],
  ])('%s with no readings -> count 0 and explicit null stats', async (type, date) => {
    const user = await createUser();
    const { status, body } = await getReport(user, `?type=${type}&date=${date}`);

    expect(status).toBe(200);
    expect(body.isEmpty).toBe(true);
    expect(body.stats).toEqual({ count: 0, highest: null, lowest: null, average: null });
    expect(body.readings).toEqual([]);
  });
});

describe('defaults and validation', () => {
  test('type defaults to daily', async () => {
    const user = await userWithFixture();
    const { body } = await getReport(user, '?date=2025-03-10');
    expect(body.type).toBe('daily');
    expect(body.stats.count).toBe(4);
  });

  test('date defaults to today (from X-Client-Date)', async () => {
    const user = await createUser();
    const { body } = await getReport(user, '?type=daily');
    expect(body.selectedDate).toBe(TODAY);
    expect(body.range).toEqual({ startDate: TODAY, endDate: TODAY });
  });

  test('date defaults to the server’s local date when no X-Client-Date is sent', async () => {
    const user = await createUser();
    const { body } = await getReport(user, '', null);
    expect(body.selectedDate).toBe(new Date().toLocaleDateString('en-CA'));
  });

  test('type is case-insensitive', async () => {
    const user = await userWithFixture();
    const { status, body } = await getReport(user, '?type=MONTHLY&date=2025-03-15');
    expect(status).toBe(200);
    expect(body.type).toBe('monthly');
  });

  test('invalid type -> 400', async () => {
    const user = await createUser();
    const res = await getReport(user, '?type=weekly&date=2025-03-10');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid report type. Allowed types: daily, month-to-date, monthly');
  });

  test.each(['10-03-2025', '2025/03/10', 'today', '2025-02-30'])('bad date "%s" -> 400', async (date) => {
    const user = await createUser();
    const res = await getReport(user, `?type=daily&date=${encodeURIComponent(date)}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Please provide a valid date in YYYY-MM-DD format.');
  });
});

describe('isolation', () => {
  test('reports only include the requesting user’s readings', async () => {
    const owner = await userWithFixture();
    const other = await createUser();
    await insertReadings(other, [['2025-03-10', 'After lunch', 599]]);

    const ownerReport = await getReport(owner, '?type=daily&date=2025-03-10');
    const otherReport = await getReport(other, '?type=daily&date=2025-03-10');
    expect(ownerReport.body.stats.highest).toBe(200);
    expect(otherReport.body.stats).toEqual({ count: 1, highest: 599, lowest: 599, average: 599 });
  });
});
