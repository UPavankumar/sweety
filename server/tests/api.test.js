/**
 * End-to-end API tests (jest + supertest) against the real database in
 * server/.env. Every account created here uses an e2e-jest-*@sweety.test
 * email and is deleted afterwards (readings cascade).
 *
 *   cd server && npm test
 */
const request = require('supertest');
const app = require('../app');
const db = require('../db');

jest.setTimeout(60000);

const STAMP = Date.now();
const mail = (tag) => `e2e-jest-${tag}-${STAMP}@sweety.test`;
const TODAY = new Date().toLocaleDateString('en-CA');
const D = '2025-03-10'; // fixed past day -> deterministic report ranges

const api = () => request(app);
const auth = (t) => ({ Authorization: `Bearer ${t}`, 'X-Client-Date': TODAY });

let tokenA;
let tokenB;

async function register(tag, extra = {}) {
  const res = await api().post('/auth/register').send({ name: `Tester ${tag}`, email: mail(tag), password: 'secret1', ...extra });
  return res;
}
const post = (token, body) => api().post('/readings').set(auth(token)).send(body);

afterAll(async () => {
  await db.query("DELETE FROM users WHERE email LIKE 'e2e-jest-%@sweety.test'");
  await db.pool.end();
});

describe('platform', () => {
  test('health reports database up', async () => {
    const res = await api().get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', database: 'up' });
  });

  test('security headers set, x-powered-by hidden', async () => {
    const res = await api().get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  test('CORS allows the dev client and rejects other origins', async () => {
    const ok = await api().get('/health').set('Origin', 'http://localhost:5173');
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const bad = await api().get('/health').set('Origin', 'https://evil.example');
    expect(bad.headers['access-control-allow-origin']).toBeUndefined();
  });

  test('unknown route 404, malformed JSON 400, oversized body 413', async () => {
    expect((await api().get('/nope')).status).toBe(404);
    const malformed = await api().post('/auth/login').set('Content-Type', 'application/json').send('{bad');
    expect(malformed.status).toBe(400);
    const big = await api().post('/auth/login').send({ email: 'a@b.co', password: 'x'.repeat(20000) });
    expect(big.status).toBe(413);
  });
});

describe('auth', () => {
  test('register validates input', async () => {
    expect((await api().post('/auth/register').send({ email: mail('x'), password: 'secret1' })).status).toBe(400);
    expect((await register('short', { password: '123' })).status).toBe(400);
    expect((await register('badmail', { email: 'not-an-email' })).body.error).toBe('Please enter a valid email address.');
    expect((await register('num', { name: 123 })).status).toBe(400);
    expect((await register('longname', { name: 'x'.repeat(300) })).status).toBe(400);
    expect((await register('longpw', { password: 'p'.repeat(200) })).status).toBe(400);
  });

  test('register normalises email/name and returns a token', async () => {
    const res = await api()
      .post('/auth/register')
      .send({ name: '  Alice  ', email: `  ${mail('a').toUpperCase()} `, password: 'secret1' });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ name: 'Alice', email: mail('a') });
    tokenA = res.body.token;
    const b = await register('b');
    expect(b.status).toBe(201);
    tokenB = b.body.token;
  });

  test('duplicate email -> 409, including simultaneous sign-ups', async () => {
    expect((await register('a')).status).toBe(409);
    const results = await Promise.all(Array.from({ length: 5 }, () => register('race')));
    const codes = results.map((r) => r.status).sort();
    expect(codes).toEqual([201, 409, 409, 409, 409]);
  });

  test('login: missing fields, unknown email, wrong password, success (case-insensitive)', async () => {
    expect((await api().post('/auth/login').send({ email: mail('a') })).status).toBe(400);
    const unknown = await api().post('/auth/login').send({ email: mail('nobody'), password: 'x' });
    expect(unknown).toMatchObject({ status: 401, body: { error: 'Email not found.' } });
    const wrong = await api().post('/auth/login').send({ email: mail('a'), password: 'nope' });
    expect(wrong).toMatchObject({ status: 401, body: { error: 'Incorrect password.' } });
    const ok = await api().post('/auth/login').send({ email: mail('a').toUpperCase(), password: 'secret1' });
    expect(ok.status).toBe(200);
    expect(ok.body.token).toBeTruthy();
  });

  test('login is rate limited per email after 10 attempts', async () => {
    const email = mail('brute');
    const codes = [];
    for (let i = 0; i < 11; i++) {
      codes.push((await api().post('/auth/login').send({ email, password: 'guess' })).status);
    }
    expect(codes.slice(0, 10).every((c) => c === 401)).toBe(true);
    expect(codes[10]).toBe(429);
    // a different account is unaffected
    expect((await api().post('/auth/login').send({ email: mail('a'), password: 'secret1' })).status).toBe(200);
  });

  test('protected routes reject missing, malformed and forged tokens', async () => {
    expect((await api().get('/readings')).status).toBe(401);
    expect((await api().get('/readings').set('Authorization', 'Bearer garbage')).status).toBe(401);
    expect((await api().get('/readings').set('Authorization', `Basic ${tokenA}`)).status).toBe(401);
    // alg:none token with a valid-looking payload
    const none = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from('{"id":1}').toString('base64url')}.`;
    expect((await api().get('/readings').set('Authorization', `Bearer ${none}`)).status).toBe(401);
    expect((await api().get('/reports').set('Authorization', 'Bearer garbage')).status).toBe(401);
  });
});

describe('readings', () => {
  const bad = [
    [{ slot: 'After lunch', value: 100 }, 'Please provide a valid date in YYYY-MM-DD format.', 'missing date'],
    [{ date: '2026-02-30', slot: 'After lunch', value: 100 }, 'Please provide a valid date in YYYY-MM-DD format.', 'impossible date'],
    [{ date: '1899-12-31', slot: 'After lunch', value: 100 }, 'Please provide a valid date in YYYY-MM-DD format.', 'pre-1900 date'],
    [{ date: '2099-01-01', slot: 'After lunch', value: 100 }, 'Date cannot be in the future.', 'future date'],
    [{ date: D, slot: 'Midnight snack', value: 100 }, null, 'bad slot'],
    [{ date: D, slot: 'After lunch' }, 'Please enter a glucose value.', 'missing value'],
    [{ date: D, slot: 'After lunch', value: '  ' }, 'Please enter a glucose value.', 'blank value'],
    [{ date: D, slot: 'After lunch', value: 39 }, 'Value must be between 40 and 600 mg/dl.', 'value 39'],
    [{ date: D, slot: 'After lunch', value: 601 }, 'Value must be between 40 and 600 mg/dl.', 'value 601'],
    [{ date: D, slot: 'After lunch', value: 100.5 }, 'Value must be between 40 and 600 mg/dl.', 'decimal'],
    [{ date: D, slot: 'After lunch', value: 'abc' }, 'Value must be between 40 and 600 mg/dl.', 'text'],
    [{ date: D, slot: 'After lunch', value: '1e2' }, 'Value must be between 40 and 600 mg/dl.', 'scientific notation'],
    [{ date: D, slot: 'After lunch', value: '0x64' }, 'Value must be between 40 and 600 mg/dl.', 'hex'],
    [{ date: D, slot: 'After lunch', value: true }, 'Value must be between 40 and 600 mg/dl.', 'boolean'],
    [{ date: D, slot: 'After lunch', value: [100] }, 'Value must be between 40 and 600 mg/dl.', 'array'],
  ];
  test.each(bad)('rejects %j (%s)', async (body, msg) => {
    const res = await post(tokenA, body);
    expect(res.status).toBe(400);
    if (msg) expect(res.body.error).toBe(msg);
  });

  test('a spoofed X-Client-Date cannot unlock future dates', async () => {
    const res = await api()
      .post('/readings')
      .set({ Authorization: `Bearer ${tokenA}`, 'X-Client-Date': '2099-12-31' })
      .send({ date: '2099-01-01', slot: 'After lunch', value: 100 });
    expect(res).toMatchObject({ status: 400, body: { error: 'Date cannot be in the future.' } });
  });

  const ids = {};
  test('creates readings at the boundaries and today', async () => {
    let res = await post(tokenA, { date: D, slot: 'Morning (fasting)', value: 40 });
    expect(res.status).toBe(201);
    expect(res.body.reading).toMatchObject({ date: D, value: 40 });
    ids.mf = res.body.reading.id;
    res = await post(tokenA, { date: D, slot: 'After breakfast', value: '600' });
    expect(res.body.reading.value).toBe(600);
    res = await post(tokenA, { date: D, slot: 'After lunch', value: 130 });
    ids.al = res.body.reading.id;
    res = await post(tokenA, { date: D, slot: 'After dinner', value: 160 });
    ids.ad = res.body.reading.id;
    res = await post(tokenA, { date: TODAY, slot: 'After lunch', value: 120 });
    expect(res.status).toBe(201);
    ids.today = res.body.reading.id;
  });

  test('one reading per slot per day (also under concurrent submits)', async () => {
    const dup = await post(tokenA, { date: D, slot: 'Morning (fasting)', value: 90 });
    expect(dup.body.error).toBe('You already have a Morning (fasting) reading for this date.');
    const results = await Promise.all(Array.from({ length: 6 }, () => post(tokenB, { date: D, slot: 'After lunch', value: 111 })));
    expect(results.map((r) => r.status).sort()).toEqual([201, 400, 400, 400, 400, 400]);
  });

  test('lists newest first and filters by date', async () => {
    const all = await api().get('/readings').set(auth(tokenA));
    expect(all.body).toHaveLength(5);
    expect(all.body[0].date).toBe(TODAY);
    const day = await api().get(`/readings?date=${D}`).set(auth(tokenA));
    expect(day.body).toHaveLength(4);
    expect((await api().get('/readings?date=garbage').set(auth(tokenA))).status).toBe(400);
  });

  test('users cannot see or change each other’s readings', async () => {
    const list = await api().get('/readings').set(auth(tokenB));
    expect(list.body.every((r) => r.user_id !== undefined && r.slot === 'After lunch')).toBe(true);
    expect(list.body).toHaveLength(1);
    const put = await api().put(`/readings/${ids.mf}`).set(auth(tokenB)).send({ date: D, slot: 'Morning (fasting)', value: 99 });
    expect(put.status).toBe(404);
    expect((await api().delete(`/readings/${ids.mf}`).set(auth(tokenB))).status).toBe(404);
  });

  test('update: value, conflicts, full day, bad ids', async () => {
    let res = await api().put(`/readings/${ids.mf}`).set(auth(tokenA)).send({ date: D, slot: 'Morning (fasting)', value: 95 });
    expect(res.body.reading.value).toBe(95);
    res = await api().put(`/readings/${ids.mf}`).set(auth(tokenA)).send({ date: D, slot: 'After lunch', value: 95 });
    expect(res.body.error).toBe('You already have a After lunch reading for this date.');
    res = await api().put(`/readings/${ids.today}`).set(auth(tokenA)).send({ date: D, slot: 'After lunch', value: 95 });
    expect(res.status).toBe(400);
    expect((await api().put('/readings/abc').set(auth(tokenA)).send({ date: D, slot: 'After lunch', value: 95 })).body.error).toBe('Invalid reading ID.');
    expect((await api().put('/readings/999999999').set(auth(tokenA)).send({ date: D, slot: 'After lunch', value: 95 })).status).toBe(404);
    expect((await api().put('/readings/99999999999').set(auth(tokenA)).send({ date: D, slot: 'After lunch', value: 95 })).status).toBe(404);
    res = await api().put(`/readings/${ids.today}`).set(auth(tokenA)).send({ date: '2025-03-01', slot: 'After dinner', value: 180 });
    expect(res.body.reading).toMatchObject({ date: '2025-03-01', slot: 'After dinner', value: 180 });
  });

  test('delete: bad id, success, repeat, re-add', async () => {
    expect((await api().delete('/readings/abc').set(auth(tokenA))).status).toBe(400);
    expect((await api().delete('/readings/99999999999').set(auth(tokenA))).status).toBe(404);
    expect((await api().delete(`/readings/${ids.ad}`).set(auth(tokenA))).status).toBe(200);
    expect((await api().delete(`/readings/${ids.ad}`).set(auth(tokenA))).status).toBe(404);
    expect((await post(tokenA, { date: D, slot: 'After dinner', value: 160 })).status).toBe(201);
  });
});

describe('reports', () => {
  // A now has 2025-03-10: 95, 600, 130, 160 and 2025-03-01: 180
  beforeAll(async () => {
    await post(tokenA, { date: '2025-02-28', slot: 'After lunch', value: 70 });
    await post(tokenA, { date: '2025-02-01', slot: 'After lunch', value: 81 });
    await post(tokenA, { date: '2025-01-31', slot: 'After lunch', value: 500 });
  });
  const report = (q, t = tokenA) => api().get(`/reports${q}`).set(auth(t));

  test('daily: stats and slot order', async () => {
    const { body } = await report(`?type=daily&date=${D}`);
    expect(body.stats).toEqual({ count: 4, highest: 600, lowest: 95, average: 246.3 });
    expect(body.readings.map((r) => r.slot)).toEqual(['Morning (fasting)', 'After breakfast', 'After lunch', 'After dinner']);
  });

  test('month-to-date range and count', async () => {
    const { body } = await report(`?type=month-to-date&date=${D}`);
    expect(body.range).toEqual({ startDate: '2025-03-01', endDate: D });
    expect(body.stats.count).toBe(5);
  });

  test('monthly = the previous calendar month', async () => {
    const { body } = await report(`?type=monthly&date=${D}`);
    expect(body.range).toEqual({ startDate: '2025-02-01', endDate: '2025-02-28' });
    expect(body.stats).toMatchObject({ count: 2, average: 75.5 });
  });

  test('empty period returns explicit nulls', async () => {
    const { body } = await report('?type=daily&date=2025-03-02');
    expect(body).toMatchObject({ isEmpty: true, stats: { count: 0, highest: null, lowest: null, average: null }, readings: [] });
  });

  test('defaults, invalid type/date, repeated params, isolation', async () => {
    const def = await report('');
    expect(def.body).toMatchObject({ type: 'daily', selectedDate: TODAY });
    expect((await report('?type=weekly')).status).toBe(400);
    expect((await report('?date=2026-02-30')).status).toBe(400);
    expect((await report('?type=daily&type=monthly')).status).toBe(400);
    expect((await report(`?type=daily&date=${D}`, tokenB)).body.stats.count).toBe(1);
  });
});

describe('database safety net', () => {
  test('CHECK constraints reject out-of-range values and unknown slots', async () => {
    const { rows } = await db.query('SELECT id FROM users WHERE email = $1', [mail('a')]);
    await expect(db.query("INSERT INTO readings (user_id, date, slot, value) VALUES ($1, '2025-01-05', 'After lunch', 700)", [rows[0].id])).rejects.toMatchObject({ code: '23514' });
    await expect(db.query("INSERT INTO readings (user_id, date, slot, value) VALUES ($1, '2025-01-05', 'Snack', 100)", [rows[0].id])).rejects.toMatchObject({ code: '23514' });
  });

  test('a token for a deleted account is rejected everywhere', async () => {
    await db.query('DELETE FROM users WHERE email = $1', [mail('b')]);
    expect((await api().get('/readings').set(auth(tokenB))).status).toBe(401);
    expect((await api().get('/reports').set(auth(tokenB))).status).toBe(401);
    expect((await post(tokenB, { date: D, slot: 'After lunch', value: 100 })).status).toBe(401);
  });
});
