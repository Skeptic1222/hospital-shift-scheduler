const request = require('supertest');

// Ensure external services are skipped for tests
process.env.SKIP_EXTERNALS = 'true';

const app = require('../../server');

describe('GET /api/health', () => {
  it('responds with health status JSON', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('services');
  });
});

