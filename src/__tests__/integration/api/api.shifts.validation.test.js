const request = require('supertest');
const express = require('express');
const createShiftsRouter = require('../../routes/shifts');

describe('Shift Validation', () => {
  it('Should_ReturnValidationError_WhenStartTimeEqualsEndTime', async () => {
    // Arrange
    const app = express();
    app.use(express.json());

    const mockGoogleAuth = {
      authenticate: () => (req, res, next) => {
        req.user = { id: '123', email: 'test@example.com' };
        next();
      },
      authorize: () => (req, res, next) => next()
    };

    const mockDb = {
      connected: true,
      query: jest.fn()
    };

    const mockRepositories = {
      shifts: {
        create: jest.fn()
      }
    };

    const mockValidate = (validators) => (req, res, next) => next();
    const mockBody = (field) => ({
      notEmpty: () => ({ withMessage: () => {} }),
      optional: () => ({
        isISO8601: () => ({ withMessage: () => {} }),
        matches: () => ({ withMessage: () => {} }),
        isInt: () => ({ withMessage: () => {} }),
        isIn: () => ({ withMessage: () => {} })
      })
    });
    const mockParam = (field) => ({
      notEmpty: () => ({ withMessage: () => {} }),
      optional: () => ({
        isISO8601: () => ({ withMessage: () => {} }),
        matches: () => ({ withMessage: () => {} }),
        isInt: () => ({ withMessage: () => {} })
      })
    });
    const mockEnsureUserAndRoles = (req, res, next) => next();

    const shiftsRouter = createShiftsRouter({
      googleAuth: mockGoogleAuth,
      repositories: mockRepositories,
      db: mockDb,
      cacheService: null,
      validate: mockValidate,
      body: mockBody,
      param: mockParam,
      ensureUserAndRoles: mockEnsureUserAndRoles
    });

    app.use('/api', shiftsRouter);

    // Act
    const response = await request(app)
      .post('/api/shifts')
      .send({
        date: '2025-09-14',
        start_time: '09:00:00',
        end_time: '09:00:00', // Same as start_time
        required_staff: 3
      });

    // Assert
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('VALIDATION_ERROR');
    expect(response.body.details).toBeDefined();
    expect(response.body.details[0].field).toBe('end_time');
    expect(response.body.details[0].message).toBe('end_time must differ from start_time');
  });
});