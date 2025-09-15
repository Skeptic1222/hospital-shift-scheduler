const request = require('supertest');
const { createFakeJwt } = require('../test-utils/token');

process.env.SKIP_EXTERNALS = 'true';

const app = require('../../server');

function authHeader(email = 'admin@example.com') {
  const token = createFakeJwt({ sub: 't-1', email, name: 'Admin User' });
  return `Bearer ${token}`;
}

describe('FCFS Queue demo endpoints', () => {
  it('returns demo queue status in SKIP_EXTERNALS mode', async () => {
    const res = await request(app)
      .get('/api/queue/status/demo-open-1')
      .set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('queue_size');
  });
});

