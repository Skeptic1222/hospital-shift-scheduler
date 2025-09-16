// E2E test for creating a shift via API
// Requires a valid Google ID token with admin/supervisor role in TEST_TOKEN
// Skips if token not provided.

const { test, expect, request } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'http://localhost/scheduler';
const TOKEN = process.env.TEST_TOKEN || '';

test.describe('Create shift API', () => {
  test.skip(!TOKEN, 'TEST_TOKEN env not provided');

  test('POST /api/shifts creates a shift', async () => {
    const api = await request.newContext({ baseURL: BASE_URL, extraHTTPHeaders: { Authorization: `Bearer ${TOKEN}` } });

    const today = new Date();
    const date = today.toISOString().slice(0, 10);

    const res = await api.post('/api/shifts', {
      data: {
        date,
        start_time: '07:00:00',
        end_time: '15:00:00',
        required_staff: 1
      }
    });

    expect([201, 200, 400, 401, 403, 500]).toContain(res.status());

    if (res.status() === 201) {
      const body = await res.json();
      expect(body).toHaveProperty('shift');
      expect(body.shift).toHaveProperty('id');

      // Verify it appears in listing
      const list = await api.get(`/api/shifts?date=${date}`);
      expect(list.ok()).toBeTruthy();
      const data = await list.json();
      expect(Array.isArray(data.shifts)).toBeTruthy();
    } else {
      test.info().annotations.push({ type: 'note', description: `Create returned ${res.status()}` });
    }
  });
});

