const request = require('supertest');

process.env.SKIP_EXTERNALS = 'true';
process.env.TRUST_PROXY = '1';

const app = require('../../server');

describe('GET /api/assets/icon', () => {
  it('returns a PNG for 192 size', async () => {
    const res = await request(app).get('/api/assets/icon?size=192');
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toMatch(/image\/png/);
  });

  it('returns a PNG for 512 size', async () => {
    const res = await request(app).get('/api/assets/icon?size=512');
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toMatch(/image\/png/);
  });
});

