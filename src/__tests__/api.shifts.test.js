const request = require('supertest');
const { createFakeJwt } = require('../test-utils/token');

process.env.SKIP_EXTERNALS = 'true';
process.env.ADMIN_EMAILS = 'admin@example.com';

const app = require('../../server');

function authHeader(email = 'admin@example.com') {
  const token = createFakeJwt({ sub: 't-1', email, name: 'Admin User' });
  return `Bearer ${token}`;
}

describe('Shifts API (SKIP_EXTERNALS=true)', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/shifts');
    expect(res.status).toBe(401);
  });

  it('lists shifts for authenticated user', async () => {
    const res = await request(app)
      .get('/api/shifts')
      .set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('shifts');
    expect(Array.isArray(res.body.shifts)).toBe(true);
  });

  it('creates a shift as admin', async () => {
    const body = { date: '2025-01-01', start_time: '07:00:00', end_time: '15:00:00', required_staff: 1 };
    const res = await request(app)
      .post('/api/shifts')
      .set('Authorization', authHeader())
      .send(body);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('shift');
  });
});
