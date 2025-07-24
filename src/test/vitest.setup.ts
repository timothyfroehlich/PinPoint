// Vitest setup file
import { beforeAll, afterAll, afterEach } from "vitest";

// Determine environment and load appropriate setup
const isJsdom = typeof window !== "undefined";

// Common setup for both environments
beforeAll(() => {
  // Set test environment variables early
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
  process.env.AUTH_SECRET = "test-auth-secret";
  process.env.NEXTAUTH_URL = "http://localhost:3000";
  process.env.PUBLIC_URL = "http://localhost:3000";
});

// MSW setup (works in Node environment for server tests)
if (!isJsdom) {
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
}

afterEach(() => {
  // Cleanup after each test
});

afterAll(() => {
  // Global cleanup
});
