// Vitest integration test setup file
// This setup is for integration tests that use REAL database connections
// DO NOT mock Prisma or database connections in this file

import { beforeAll, afterAll, afterEach } from "vitest";

// CRITICAL: Fix AbortSignal before any imports that might use fetch/tRPC
// The tRPC + MSW + Node.js undici combination requires consistent AbortSignal implementation
const NodeAbortController = globalThis.AbortController;
const NodeAbortSignal = globalThis.AbortSignal;

// Force global consistency for all environments - this prevents the
// "Expected signal to be an instance of AbortSignal" error in tRPC tests
globalThis.AbortController = NodeAbortController;
globalThis.AbortSignal = NodeAbortSignal;

// Integration test setup - no database mocking
beforeAll(() => {
  // Environment variables are loaded by src/lib/env-loaders/test.ts from .env.test
  // Ensure we have a real DATABASE_URL for integration tests
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is required for integration tests. Ensure Supabase is running and .env.test is properly configured.",
    );
  }

  // Verify we're not accidentally using test/mock URLs
  if (
    process.env.DATABASE_URL.includes("test://") ||
    process.env.DATABASE_URL.includes("mock://")
  ) {
    throw new Error(
      "Integration tests require a real database URL, not a test/mock URL. Check .env.test configuration.",
    );
  }
});

// MSW setup for integration tests (if needed for external API mocking)
let server: ReturnType<(typeof import("msw/node"))["setupServer"]> | null =
  null;

beforeAll(async () => {
  const { server: mswServer } = await import("./msw/setup");
  server = mswServer;
  server.listen({
    onUnhandledRequest: "warn", // Warn on unhandled requests
  });
});

afterEach(() => {
  server?.resetHandlers();
});

afterAll(() => {
  server?.close();
});

afterEach(() => {
  // Cleanup after each test
});

afterAll(() => {
  // Global cleanup
});
