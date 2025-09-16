const request = require('supertest');
const express = require('express');
const createHealthRouter = require('../../routes/health');

describe('Health Route', () => {
  it('Should_ReturnHealthyStatus_WhenAllServicesAreUp', async () => {
    // Arrange
    const app = express();
    const mockDb = {
      healthCheck: jest.fn().mockResolvedValue({ healthy: true })
    };
    const mockCacheService = {
      client: { status: 'ready' }
    };

    const healthRouter = createHealthRouter({
      db: mockDb,
      cacheService: mockCacheService
    });
    app.use('/api', healthRouter);

    // Act
    const response = await request(app).get('/api/health');

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('healthy');
    expect(response.body.services.database.healthy).toBe(true);
    expect(response.body.services.cache.connected).toBe(true);
    expect(response.body.services.notifications.connected).toBe(true);
  });
});