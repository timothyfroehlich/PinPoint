// Vitest setup file
import { beforeAll, afterAll, afterEach } from "vitest";

// CRITICAL: Fix AbortSignal before any imports that might use fetch/tRPC
// The tRPC + MSW + Node.js undici combination requires consistent AbortSignal implementation
const NodeAbortController = globalThis.AbortController;
const NodeAbortSignal = globalThis.AbortSignal;

// Force global consistency for all environments - this prevents the
// "Expected signal to be an instance of AbortSignal" error in tRPC tests
globalThis.AbortController = NodeAbortController;
globalThis.AbortSignal = NodeAbortSignal;

// Common setup for both environments
beforeAll(() => {
  // Set test environment variables early (NODE_ENV is set by test runner)
  // Use Object.assign to avoid TypeScript/ESLint conflicts with env variable assignment
  Object.assign(process.env, {
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    AUTH_SECRET: "test-auth-secret",
    NEXTAUTH_URL: "http://localhost:3000",
    PUBLIC_URL: "http://localhost:3000",
    // Google OAuth credentials for test environment
    GOOGLE_CLIENT_ID: "test-google-client-id",
    GOOGLE_CLIENT_SECRET: "test-google-client-secret",
  });

  // Note: Fetch patching moved to VitestTestWrapper to avoid Vitest startup conflicts
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
