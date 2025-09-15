const request = require('supertest');
const { createFakeJwt } = require('../test-utils/token');

process.env.SKIP_EXTERNALS = 'true';
process.env.ADMIN_EMAILS = 'admin@example.com';

const app = require('../../server');

function authHeader(email = 'admin@example.com') {
  const token = createFakeJwt({ sub: 'admin-1', email, name: 'Admin User' });
  return `Bearer ${token}`;
}

describe('Admin assign-role upsert (demo)', () => {
  it('creates or updates a user record and assigns role (demo)', async () => {
    const body = { email: 'new.user@example.com', roleName: 'supervisor', first_name: 'New', last_name: 'User' };
    const res = await request(app)
      .post('/api/admin/users/assign-role')
      .set('Authorization', authHeader())
      .send(body);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ updated: true }));
  });
});

