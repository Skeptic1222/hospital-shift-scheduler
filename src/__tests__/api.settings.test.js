const request = require('supertest');
const { createFakeJwt } = require('../test-utils/token');

process.env.SKIP_EXTERNALS = 'true';

const app = require('../../server');

function authHeader(email = 'user@example.com') {
  const token = createFakeJwt({ sub: 'user-1', email, name: 'User One' });
  return `Bearer ${token}`;
}

describe('Settings (demo)', () => {
  it('loads default settings (demo)', async () => {
    const res = await request(app)
      .get('/api/settings')
      .set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('settings');
    expect(res.body.settings).toHaveProperty('notifications');
  });
});

