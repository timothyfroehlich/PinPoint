import "@testing-library/jest-dom";

// Mock environment variables for testing
process.env.OPDB_API_TOKEN = "test-token";
process.env.OPDB_API_URL = "https://opdb.org/api";
process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test_db";

// Mock fetch globally for tests
global.fetch = jest.fn();

// Reset all mocks after each test
afterEach(() => {
  jest.clearAllMocks();
});
