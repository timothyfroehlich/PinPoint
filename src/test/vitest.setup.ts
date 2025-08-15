// Vitest setup file
import { beforeAll, afterAll, afterEach, vi } from "vitest";

// Mock the server/db/drizzle module with Drizzle-only patterns
vi.mock("~/server/db/drizzle", () => {
  // Create comprehensive Drizzle mock that matches the database client interface
  const mockDb = {
    // Core Drizzle methods
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: vi.fn(),
    execute: vi.fn(),
    transaction: vi.fn(),

    // Drizzle query methods for relational queries
    query: {
      users: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      organizations: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      memberships: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      issues: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      locations: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      machines: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      models: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      issueStatuses: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      priorities: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      roles: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      permissions: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      notifications: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      comments: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      issueComments: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
    },
  };

  return {
    createDrizzleClient: vi.fn(() => mockDb),
  };
});

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
  // Environment variables are now loaded by src/lib/env-loaders/test.ts from .env.test
  // No manual environment variable assignment needed
  // Note: Fetch patching moved to VitestTestWrapper to avoid Vitest startup conflicts
});

/**
 * MSW server setup for both Node and jsdom environments.
 *
 * This pattern uses nullable initialization and dynamic imports for several critical reasons:
 *
 * 1. **Prevent test runner startup conflicts**: Static imports of MSW can conflict with Vitest's
 *    global fetch patching, causing "fetch is not defined" errors during test startup.
 *
 * 2. **Environment compatibility**: Both Node and jsdom environments need MSW, but static imports
 *    may cause module loading errors when switching between environments in the same process.
 *
 * 3. **Avoid circular dependencies**: Static imports in setup files can create circular dependency
 *    issues with modules that also import test utilities.
 *
 * 4. **Conditional loading**: Allows MSW to be loaded only when actually needed, preventing
 *    unnecessary overhead in tests that don't require HTTP mocking.
 *
 * The nullable server pattern ensures graceful handling if MSW import fails and allows
 * proper cleanup without assuming the server was successfully initialized.
 */
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
