const request = require('supertest');
const { createFakeJwt } = require('../test-utils/token');

process.env.SKIP_EXTERNALS = 'true';

const app = require('../../server');

function authHeader(email = 'admin@example.com') {
  const token = createFakeJwt({ sub: 'user-1', email, name: 'Test User' });
  return `Bearer ${token}`;
}

describe('Notifications subscribe (demo)', () => {
  it('accepts a push subscription', async () => {
    const res = await request(app)
      .post('/api/notifications/subscribe')
      .set('Authorization', authHeader())
      .send({ subscription: { endpoint: 'https://example.test', keys: { p256dh: 'k', auth: 'a' } }, types: ['shift_available'] });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ subscribed: true }));
  });
});

