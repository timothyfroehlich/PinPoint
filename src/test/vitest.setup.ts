// Vitest setup file
import { beforeAll, afterAll, afterEach } from 'vitest';

// Add any global test setup here
beforeAll(() => {
  // Global setup
});

afterEach(() => {
  // Cleanup after each test
});

afterAll(() => {
  // Global cleanup
});

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test';
