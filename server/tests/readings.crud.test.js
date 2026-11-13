const { db, api, applySchema, resetDb, createUser, authHeaders, postReading } = require('./helpers/testDb');

jest.setTimeout(30000);

beforeAll(applySchema);
beforeEach(resetDb);
afterAll(() => db.pool.end());

const getReadings = (user, query = '') => api().get(`/readings${query}`).set(authHeaders(user.token));
const putReading = (user, id, body) => api().put(`/readings/${id}`).set(authHeaders(user.token)).send(body);
const deleteReading = (user, id) => api().delete(`/readings/${id}`).set(authHeaders(user.token));

describe('POST /readings', () => {
  test('creates a reading for the authenticated user', async () => {
    const user = await createUser();
    const res = await postReading(user, { date: '2025-03-10', slot: 'After lunch', value: 132 });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Reading recorded successfully.');
    expect(res.body.reading).toMatchObject({
      id: expect.any(Number),
      user_id: user.id,
      date: '2025-03-10',
      slot: 'After lunch',
      value: 132,
    });

    const { rows } = await db.query('SELECT user_id, slot, value FROM readings');
    expect(rows).toEqual([{ user_id: user.id, slot: 'After lunch', value: 132 }]);
  });

  test('ignores a user_id in the body (always uses the token owner)', async () => {
    const owner = await createUser();
    const other = await createUser();
    const res = await api()
      .post('/readings')
      .set(authHeaders(owner.token))
      .send({ date: '2025-03-10', slot: 'After lunch', value: 120, user_id: other.id });
    expect(res.status).toBe(201);
    expect(res.body.reading.user_id).toBe(owner.id);
  });
});

describe('GET /readings', () => {
  test('returns an empty list for a new user', async () => {
    const user = await createUser();
    const res = await getReadings(user);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('returns the user’s readings, newest date first', async () => {
    const user = await createUser();
    await postReading(user, { date: '2025-03-01', slot: 'After lunch' });
    await postReading(user, { date: '2025-03-15', slot: 'Morning (fasting)' });
    await postReading(user, { date: '2025-03-15', slot: 'After dinner' });
    await postReading(user, { date: '2025-03-08', slot: 'After breakfast' });

    const res = await getReadings(user);
    expect(res.status).toBe(200);
    expect(res.body.map((r) => r.date)).toEqual(['2025-03-15', '2025-03-15', '2025-03-08', '2025-03-01']);
    // within a day: newest id first
    expect(res.body[0].slot).toBe('After dinner');
  });

  test('?date= filters to that day only', async () => {
    const user = await createUser();
    await postReading(user, { date: '2025-03-10', slot: 'Morning (fasting)' });
    await postReading(user, { date: '2025-03-10', slot: 'After lunch' });
    await postReading(user, { date: '2025-03-11', slot: 'After lunch' });

    const res = await getReadings(user, '?date=2025-03-10');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.every((r) => r.date === '2025-03-10')).toBe(true);

    const empty = await getReadings(user, '?date=2025-03-12');
    expect(empty.body).toEqual([]);
  });

  test('a user never sees another user’s readings', async () => {
    const alice = await createUser();
    const bob = await createUser();
    await postReading(alice, { slot: 'After lunch', value: 111 });
    await postReading(bob, { slot: 'After lunch', value: 222 });

    const aliceList = await getReadings(alice);
    const bobList = await getReadings(bob);
    expect(aliceList.body.map((r) => r.value)).toEqual([111]);
    expect(bobList.body.map((r) => r.value)).toEqual([222]);
    expect(aliceList.body.every((r) => r.user_id === alice.id)).toBe(true);
  });
});

describe('PUT /readings/:id', () => {
  test('updates value, slot and date of an own reading', async () => {
    const user = await createUser();
    const { body } = await postReading(user, { date: '2025-03-10', slot: 'After lunch', value: 120 });

    const res = await putReading(user, body.reading.id, { date: '2025-03-09', slot: 'After dinner', value: 150 });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Reading updated successfully.');
    expect(res.body.reading).toMatchObject({ id: body.reading.id, date: '2025-03-09', slot: 'After dinner', value: 150 });
  });

  test('keeping the same date and slot is allowed (the reading is excluded from its own duplicate check)', async () => {
    const user = await createUser();
    const { body } = await postReading(user, { slot: 'After lunch', value: 120 });
    const res = await putReading(user, body.reading.id, { date: '2025-03-10', slot: 'After lunch', value: 125 });
    expect(res.status).toBe(200);
    expect(res.body.reading.value).toBe(125);
  });

  test('editing a reading on a full day is allowed (excluded from the 4-per-day count)', async () => {
    const user = await createUser();
    let lastId;
    for (const slot of ['Morning (fasting)', 'After breakfast', 'After lunch', 'After dinner']) {
      lastId = (await postReading(user, { slot })).body.reading.id;
    }
    const res = await putReading(user, lastId, { date: '2025-03-10', slot: 'After dinner', value: 199 });
    expect(res.status).toBe(200);
  });

  test('moving to a slot already used that day -> 400', async () => {
    const user = await createUser();
    await postReading(user, { slot: 'Morning (fasting)' });
    const { body } = await postReading(user, { slot: 'After lunch' });

    const res = await putReading(user, body.reading.id, { date: '2025-03-10', slot: 'Morning (fasting)', value: 100 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('You already have a Morning (fasting) reading for this date.');
  });

  test('applies the same field validation as create', async () => {
    const user = await createUser();
    const { body } = await postReading(user);
    const id = body.reading.id;

    expect((await putReading(user, id, { date: '2025-03-10', slot: 'Morning (fasting)', value: 601 })).body.error).toBe(
      'Value must be between 40 and 600 mg/dl.'
    );
    expect((await putReading(user, id, { date: '2025-04-01', slot: 'Morning (fasting)', value: 100 })).body.error).toBe(
      'Date cannot be in the future.'
    );
    expect((await putReading(user, id, { date: 'bad', slot: 'Morning (fasting)', value: 100 })).body.error).toBe(
      'Please provide a valid date in YYYY-MM-DD format.'
    );
    expect((await putReading(user, id, { date: '2025-03-10', slot: 'Brunch', value: 100 })).status).toBe(400);
  });

  test('another user’s reading -> 404 and is left unchanged', async () => {
    const owner = await createUser();
    const intruder = await createUser();
    const { body } = await postReading(owner, { value: 100 });

    const res = await putReading(intruder, body.reading.id, { date: '2025-03-10', slot: 'Morning (fasting)', value: 300 });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Reading not found.');

    const { rows } = await db.query('SELECT value FROM readings WHERE id = $1', [body.reading.id]);
    expect(rows[0].value).toBe(100);
  });

  test('non-existent id -> 404', async () => {
    const user = await createUser();
    const res = await putReading(user, 999999, { date: '2025-03-10', slot: 'Morning (fasting)', value: 100 });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Reading not found.');
  });
});

describe('DELETE /readings/:id', () => {
  test('deletes an own reading', async () => {
    const user = await createUser();
    const { body } = await postReading(user);

    const res = await deleteReading(user, body.reading.id);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Reading deleted successfully.', id: body.reading.id });
    expect((await getReadings(user)).body).toEqual([]);
  });

  test('the freed slot can be used again', async () => {
    const user = await createUser();
    const { body } = await postReading(user, { slot: 'After lunch' });
    await deleteReading(user, body.reading.id);
    expect((await postReading(user, { slot: 'After lunch' })).status).toBe(201);
  });

  test('deleting twice -> 404 the second time', async () => {
    const user = await createUser();
    const { body } = await postReading(user);
    await deleteReading(user, body.reading.id);
    const res = await deleteReading(user, body.reading.id);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Reading not found.');
  });

  test('another user’s reading -> 404 and it still exists', async () => {
    const owner = await createUser();
    const intruder = await createUser();
    const { body } = await postReading(owner);

    const res = await deleteReading(intruder, body.reading.id);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Reading not found.');

    const { rows } = await db.query('SELECT id FROM readings WHERE id = $1', [body.reading.id]);
    expect(rows).toHaveLength(1);
  });

  test('non-numeric id -> 400', async () => {
    const user = await createUser();
    const res = await deleteReading(user, 'abc');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid reading ID.');
  });
});

describe('account deletion', () => {
  test('deleting a user removes their readings (ON DELETE CASCADE)', async () => {
    const user = await createUser();
    await postReading(user, { slot: 'After lunch' });
    await postReading(user, { slot: 'After dinner' });
    await db.query('DELETE FROM users WHERE id = $1', [user.id]);
    const { rows } = await db.query('SELECT count(*)::int AS n FROM readings');
    expect(rows[0].n).toBe(0);
  });
});
