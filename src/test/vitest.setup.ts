// Vitest setup file
import { beforeAll, afterAll, afterEach, vi } from "vitest";

// CRITICAL: Mock Prisma client BEFORE any imports to prevent real database connections
vi.mock("@prisma/client", () => ({
  PrismaClient: vi.fn(() => {
    // Create a comprehensive mock that matches the ExtendedPrismaClient interface
    const mockClient = {
      $extends: vi.fn(() => mockClient), // Return self for chaining
      $connect: vi.fn(),
      $disconnect: vi.fn(),
      $transaction: vi.fn(),
      $queryRaw: vi.fn(),
      $executeRaw: vi.fn(),
      // Add all model mocks
      user: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
      },
      membership: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      organization: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      issue: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
      },
      // Add other models as needed
      location: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      machine: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      model: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      issueStatus: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      priority: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      role: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      permission: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      notification: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        createMany: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      comment: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      issueComment: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };
    return mockClient;
  }),
  // Add Prisma-generated enums and types that are imported in the codebase
  StatusCategory: {
    NEW: "NEW",
    IN_PROGRESS: "IN_PROGRESS",
    RESOLVED: "RESOLVED",
  },
  NotificationType: {
    ISSUE_CREATED: "ISSUE_CREATED",
    ISSUE_STATUS_CHANGED: "ISSUE_STATUS_CHANGED",
    ISSUE_ASSIGNED: "ISSUE_ASSIGNED",
    COMMENT_ADDED: "COMMENT_ADDED",
  },
  NotificationEntity: {
    ISSUE: "ISSUE",
    COMMENT: "COMMENT",
  },
  // Add Prisma namespace mock for type imports
  Prisma: {
    // Add common Prisma utilities that might be imported
    UserScalarFieldEnum: {},
    IssueScalarFieldEnum: {},
  },
}));

// Mock Prisma Accelerate extension
vi.mock("@prisma/extension-accelerate", () => ({
  withAccelerate: vi.fn(() => (client: object) => ({
    ...client,
    $accelerate: {
      invalidate: vi.fn(),
      ttl: vi.fn(),
    },
  })),
}));

// Mock the server/db module to use our mocked PrismaClient
vi.mock("~/server/db", () => {
  const mockDb = {
    $extends: vi.fn().mockReturnThis(),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
    $accelerate: {
      invalidate: vi.fn(),
      ttl: vi.fn(),
    },
    // Add all model mocks with the exact same structure as vitestMockContext
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    membership: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    organization: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    role: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    permission: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    location: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    issue: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    machine: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    model: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    notification: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    issueStatus: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    priority: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    issueComment: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    comment: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };

  return {
    createPrismaClient: vi.fn(() => mockDb),
    // Export the mock db directly for backwards compatibility
    default: mockDb,
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
