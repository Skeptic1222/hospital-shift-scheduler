const request = require('supertest');

// Ensure test mode so server.js doesn't listen/connect
process.env.NODE_ENV = 'test';

// Import the Express app
const app = require('../server');

describe('AuthZ: Protected endpoints require Authorization header', () => {
  it('GET /api/shifts returns 401 without Authorization', async () => {
    const res = await request(app).get('/api/shifts');
    expect(res.status).toBe(401);
  });

  it('GET /api/admin/status returns 401 without Authorization', async () => {
    const res = await request(app).get('/api/admin/status');
    expect(res.status).toBe(401);
  });
});

