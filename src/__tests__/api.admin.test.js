const request = require('supertest');
const { createFakeJwt } = require('../test-utils/token');

process.env.SKIP_EXTERNALS = 'true';
process.env.ADMIN_EMAILS = 'admin@example.com';

const app = require('../../server');

function authHeader(email = 'admin@example.com') {
  const token = createFakeJwt({ sub: 't-1', email, name: 'Admin User' });
  return `Bearer ${token}`;
}

describe('Admin API (roles)', () => {
  it('requires admin role', async () => {
    const res = await request(app)
      .get('/api/admin/roles')
      .set('Authorization', authHeader('user@example.com'));
    expect(res.status).toBe(403);
  });

  it('allows admin to list roles', async () => {
    const res = await request(app)
      .get('/api/admin/roles')
      .set('Authorization', authHeader('admin@example.com'));
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('roles');
  });
});
