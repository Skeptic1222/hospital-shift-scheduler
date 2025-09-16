# Hospital Scheduler Testing Guide

## Overview
Comprehensive testing procedures for the Hospital Scheduler system including unit, integration, E2E, and performance testing.

## Test Architecture

```
src/__tests__/
├── unit/
│   ├── algorithms/
│   │   └── fcfs-algorithm.test.js
│   ├── services/
│   │   ├── auth.test.js
│   │   └── cache.test.js
│   └── utils/
├── integration/
│   ├── api/
│   │   ├── auth.integration.test.js
│   │   ├── shifts.integration.test.js
│   │   └── admin.integration.test.js
│   └── database/
├── ui/
│   ├── components/
│   └── pages/
└── e2e/
    └── critical-workflows.test.js
```

## Running Tests

### All Tests
```bash
npm test
```

### Specific Test Suites
```bash
npm test -- --testPathPattern=unit
npm test -- --testPathPattern=integration
npm test -- --testPathPattern=e2e
```

### Coverage Report
```bash
npm test -- --coverage
```

### Watch Mode
```bash
npm test -- --watch
```

## Test Standards

### Naming Convention
Follow TDD Guard System naming:
```javascript
test('Should_ReturnHealthyStatus_WhenAllServicesAreUp', () => {
  // Test implementation
});
```

### HIPAA Compliance in Tests
- Never use real patient data
- Use sanitized test fixtures
- Ensure PHI is not logged
- Test encryption/decryption

### Mocking Strategy
```javascript
// Mock external services
jest.mock('../services/auth-service');
jest.mock('../db-config');

// Mock with implementation
authService.validateToken.mockResolvedValue({
  valid: true,
  userId: 'test-user'
});
```

## Unit Testing

### Algorithm Testing
```javascript
describe('FCFS Algorithm', () => {
  test('Should_CalculateCorrectPriority_WhenAllFactorsPresent', () => {
    const result = calculatePriority({
      seniority: 5,
      lastShiftWorked: '2024-01-01',
      skillMatch: 0.8,
      availability: 1.0
    });
    expect(result).toBeCloseTo(expectedScore, 2);
  });
});
```

### Service Testing
```javascript
describe('Auth Service', () => {
  test('Should_ValidateJWT_WhenTokenIsValid', async () => {
    const token = generateTestToken();
    const result = await authService.validateToken(token);
    expect(result.valid).toBe(true);
  });
});
```

## Integration Testing

### API Integration
```javascript
describe('Shifts API Integration', () => {
  beforeEach(async () => {
    await db.migrate.latest();
    await db.seed.run();
  });

  test('Should_CreateShift_WhenValidDataProvided', async () => {
    const response = await request(app)
      .post('/api/shifts')
      .set('Authorization', `Bearer ${token}`)
      .send(validShiftData);

    expect(response.status).toBe(201);
    expect(response.body.shift_id).toBeDefined();
  });
});
```

### Database Integration
```javascript
describe('Database Operations', () => {
  test('Should_HandleTransactions_WhenMultipleOperations', async () => {
    await db.transaction(async (trx) => {
      await createShift(trx, shiftData);
      await updateStaffAvailability(trx, staffId);
      await logAuditEvent(trx, auditData);
    });
  });
});
```

## UI Testing

### Component Testing
```javascript
import { render, screen, fireEvent } from '@testing-library/react';

describe('CreateShiftDialog', () => {
  test('Should_ValidateForm_WhenRequiredFieldsMissing', () => {
    render(<CreateShiftDialog open={true} />);

    const submitButton = screen.getByRole('button', { name: /create/i });
    fireEvent.click(submitButton);

    expect(screen.getByText(/required/i)).toBeInTheDocument();
  });
});
```

### Accessibility Testing
```javascript
import { axe } from 'jest-axe';

test('Should_HaveNoA11yViolations_WhenRendered', async () => {
  const { container } = render(<Dashboard />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

## E2E Testing

### Critical Workflows
```javascript
describe('Shift Assignment Workflow', () => {
  test('Should_CompleteFullShiftCycle_FromCreationToClaim', async () => {
    // Login
    await page.goto('/login');
    await page.fill('[name="email"]', 'admin@hospital.com');
    await page.fill('[name="password"]', 'testpass');
    await page.click('[type="submit"]');

    // Create shift
    await page.click('[data-testid="create-shift"]');
    await page.fill('[name="department"]', 'ICU');
    await page.fill('[name="start_time"]', '2024-01-15T08:00');
    await page.click('[data-testid="submit-shift"]');

    // Verify in queue
    await page.goto('/queue');
    await expect(page.locator('.shift-card')).toContainText('ICU');
  });
});
```

## Performance Testing

### Load Testing
```javascript
describe('Performance', () => {
  test('Should_HandleConcurrentRequests_WithoutDegradation', async () => {
    const requests = Array(100).fill(null).map(() =>
      request(app).get('/api/shifts')
    );

    const start = Date.now();
    await Promise.all(requests);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(5000); // 5 seconds for 100 requests
  });
});
```

### Memory Leak Testing
```javascript
test('Should_NotLeakMemory_WhenProcessingMultipleRequests', async () => {
  const initialMemory = process.memoryUsage().heapUsed;

  for (let i = 0; i < 1000; i++) {
    await processShiftAssignment(testData);
  }

  global.gc(); // Force garbage collection
  const finalMemory = process.memoryUsage().heapUsed;

  expect(finalMemory - initialMemory).toBeLessThan(50 * 1024 * 1024); // 50MB threshold
});
```

## Test Data Management

### Fixtures
```javascript
// test-fixtures/shifts.js
export const validShift = {
  department_code: 'ICU',
  start_time: '2024-01-15T08:00:00',
  end_time: '2024-01-15T20:00:00',
  required_staff: 3,
  skill_requirements: ['ACLS', 'BLS']
};

// test-fixtures/users.js
export const testAdmin = {
  email: 'admin@test.com',
  role: 'ADMIN',
  department_code: 'ICU'
};
```

### Database Seeding
```javascript
// seeds/test-data.js
exports.seed = async (knex) => {
  await knex('staff').del();
  await knex('staff').insert([
    { staff_id: 1, name: 'Test Nurse', department_code: 'ICU' },
    { staff_id: 2, name: 'Test Doctor', department_code: 'ED' }
  ]);
};
```

## Continuous Integration

### GitHub Actions
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm ci
      - run: npm test -- --coverage
      - uses: codecov/codecov-action@v2
```

## Debugging Tests

### Debug Mode
```bash
node --inspect-brk ./node_modules/.bin/jest --runInBand
```

### Verbose Output
```bash
npm test -- --verbose
```

### Single Test
```bash
npm test -- --testNamePattern="Should_ValidateToken"
```

## Test Coverage Goals

- Unit Tests: 80% coverage minimum
- Integration Tests: All API endpoints
- E2E Tests: Critical user workflows
- Performance: Response time < 200ms
- Security: All HIPAA requirements

## Common Issues

### Test Database Connection
Ensure test database is configured:
```javascript
// jest.setup.js
beforeAll(async () => {
  await db.migrate.latest();
});

afterAll(async () => {
  await db.destroy();
});
```

### Async Testing
Always use async/await or return promises:
```javascript
test('async test', async () => {
  const data = await fetchData();
  expect(data).toBeDefined();
});
```

### Cleanup
Ensure proper cleanup between tests:
```javascript
afterEach(async () => {
  jest.clearAllMocks();
  await db('shifts').del();
});
```