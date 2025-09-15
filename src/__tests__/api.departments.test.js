const request = require('supertest');
const { createFakeJwt } = require('../test-utils/token');

process.env.SKIP_EXTERNALS = 'true';

const app = require('../../server');

function authHeader(email = 'admin@example.com') {
  const token = createFakeJwt({ sub: 't-1', email, name: 'Admin User' });
  return `Bearer ${token}`;
}

describe('Departments (demo)', () => {
  it('lists departments in demo mode', async () => {
    const res = await request(app)
      .get('/api/departments')
      .set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('departments');
    expect(Array.isArray(res.body.departments)).toBe(true);
  });
});

