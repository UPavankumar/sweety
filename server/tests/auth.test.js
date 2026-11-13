const { db, api, applySchema, resetDb, createUser, PASSWORD } = require('./helpers/testDb');

jest.setTimeout(30000);

beforeAll(applySchema);
beforeEach(resetDb);
afterAll(() => db.pool.end());

const newUser = (overrides = {}) => ({ name: 'Jane Doe', email: 'jane@sweety.test', password: 'secret1', ...overrides });

describe('POST /auth/register', () => {
  test('creates the user and returns a token and public profile', async () => {
    const res = await api().post('/auth/register').send(newUser());

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Registration successful.');
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user).toEqual({ id: expect.any(Number), name: 'Jane Doe', email: 'jane@sweety.test' });
    expect(res.body.user).not.toHaveProperty('password_hash');

    const { rows } = await db.query('SELECT email, password_hash FROM users');
    expect(rows).toHaveLength(1);
    expect(rows[0].password_hash).not.toBe('secret1'); // stored hashed, never in plain text
  });

  test('the returned token works on a protected route', async () => {
    const { body } = await api().post('/auth/register').send(newUser());
    const res = await api().get('/readings').set('Authorization', `Bearer ${body.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test.each([
    ['name', { name: undefined }],
    ['email', { email: undefined }],
    ['password', { password: undefined }],
  ])('missing %s -> 400', async (_field, overrides) => {
    const res = await api().post('/auth/register').send(newUser(overrides));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Please provide name, email, and password.');
  });

  test('password shorter than 6 characters -> 400', async () => {
    const res = await api().post('/auth/register').send(newUser({ password: '12345' }));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Password must be at least 6 characters long.');
  });

  test('a 6-character password is accepted', async () => {
    const res = await api().post('/auth/register').send(newUser({ password: '123456' }));
    expect(res.status).toBe(201);
  });

  test('duplicate email -> 409 (case-insensitive)', async () => {
    await api().post('/auth/register').send(newUser());
    const res = await api().post('/auth/register').send(newUser({ email: 'JANE@Sweety.test' }));
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Email is already registered.');
  });
});

describe('POST /auth/login', () => {
  test('valid credentials -> 200 with token and user', async () => {
    const user = await createUser();
    const res = await api().post('/auth/login').send({ email: user.email, password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Login successful.');
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user).toEqual({ id: user.id, name: user.name, email: user.email });
  });

  test.each([
    ['email', { password: PASSWORD }],
    ['password', { email: 'someone@sweety.test' }],
  ])('missing %s -> 400', async (_field, body) => {
    const res = await api().post('/auth/login').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Please enter both email and password.');
  });

  test('unknown email -> 401 "Email not found."', async () => {
    const res = await api().post('/auth/login').send({ email: 'nobody@sweety.test', password: PASSWORD });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Email not found.');
  });

  test('wrong password -> 401 "Incorrect password."', async () => {
    const user = await createUser();
    const res = await api().post('/auth/login').send({ email: user.email, password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Incorrect password.');
  });
});

describe('protected routes (middleware/auth.js)', () => {
  test.each(['/readings', '/reports'])('%s without a token -> 401', async (route) => {
    const res = await api().get(route);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Access denied. No token provided.');
  });

  test.each(['/readings', '/reports'])('%s with an invalid token -> 401', async (route) => {
    const res = await api().get(route).set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid or malformed token.');
  });

  test('a token whose account no longer exists -> 401', async () => {
    const user = await createUser();
    await db.query('DELETE FROM users WHERE id = $1', [user.id]);
    const res = await api().get('/readings').set('Authorization', `Bearer ${user.token}`);
    expect(res.status).toBe(401);
  });
});
