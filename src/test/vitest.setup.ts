// Vitest setup file
import { beforeAll, afterAll, afterEach } from "vitest";

// Determine environment and load appropriate setup
const _isJsdom = typeof window !== "undefined";

// Temporarily revert MSW polyfills to focus on core issue
// Will implement direct tRPC mocking instead of MSW HTTP interception

// Common setup for both environments
beforeAll(() => {
  // Set test environment variables early (NODE_ENV is set by test runner)
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
  process.env.AUTH_SECRET = "test-auth-secret";
  process.env.NEXTAUTH_URL = "http://localhost:3000";
  process.env.PUBLIC_URL = "http://localhost:3000";
  // Google OAuth credentials for test environment
  process.env.GOOGLE_CLIENT_ID = "test-google-client-id";
  process.env.GOOGLE_CLIENT_SECRET = "test-google-client-secret";
});

// MSW setup for both Node and jsdom environments
const { server } = await import("./msw/setup");

beforeAll(() => {
  server.listen({
    onUnhandledRequest: "warn", // Warn on unhandled requests
  });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

afterEach(() => {
  // Cleanup after each test
});

afterAll(() => {
  // Global cleanup
});
