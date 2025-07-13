import "@testing-library/jest-dom";

// Mock environment variables for testing
process.env.NODE_ENV = "test";
process.env.AUTH_SECRET = "test-auth-secret";
process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test_db";
process.env.GOOGLE_CLIENT_ID = "test-google-client-id";
process.env.GOOGLE_CLIENT_SECRET = "test-google-client-secret";
process.env.OPDB_API_URL = "https://opdb.org/api";
process.env.DEFAULT_ORG_SUBDOMAIN = "apc";
process.env.OPDB_API_TOKEN = "test-token";
process.env.IMAGE_STORAGE_PROVIDER = "local";

// Mock fetch globally for tests
global.fetch = jest.fn();

// Mock Next.js server APIs for tests
global.Request = jest.fn().mockImplementation((input, init) => ({
  url: input,
  method: init?.method || "GET",
  headers: new Map(Object.entries(init?.headers || {})),
  json: jest.fn().mockResolvedValue({}),
  text: jest.fn().mockResolvedValue(""),
}));

global.Response = jest.fn().mockImplementation((body, init) => ({
  ok: true,
  status: init?.status || 200,
  json: jest.fn().mockResolvedValue(body),
  text: jest.fn().mockResolvedValue(String(body)),
}));

// Mock NextResponse
jest.mock("next/server", () => ({
  NextResponse: {
    json: jest.fn().mockImplementation((data, init) => ({
      json: jest.fn().mockResolvedValue(data),
      status: init?.status || 200,
    })),
  },
}));

// Reset all mocks after each test
afterEach(() => {
  jest.clearAllMocks();
});
