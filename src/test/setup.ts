import "@testing-library/jest-dom/vitest";
import { vi, afterEach } from "vitest";

// Environment variables are now loaded from .env.test via src/lib/env-loaders/test.ts
// No manual environment variable assignment needed

// Mock fetch globally for tests
global.fetch = vi.fn();

// Create a mock Drizzle client
const mockDrizzleClient = {
  // Core Drizzle query methods
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

  // Drizzle relational query API
  query: {
    organizations: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    users: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    memberships: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    issues: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    machines: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    locations: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    attachments: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    models: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    issueStatuses: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    priorities: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    issueHistories: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    notifications: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    pinballMapConfigs: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
};

// Mock database module
vi.mock("~/server/db/drizzle", () => ({
  createDrizzleClient: vi.fn(() => mockDrizzleClient),
}));

// Mock database provider with Drizzle-only patterns
const mockDatabaseProvider = {
  getClient: vi.fn().mockReturnValue(mockDrizzleClient),
  disconnect: vi.fn().mockResolvedValue(undefined),
  reset: vi.fn(),
};

vi.mock("~/server/db/provider", () => ({
  DatabaseProvider: vi.fn().mockImplementation(() => mockDatabaseProvider),
  getGlobalDatabaseProvider: vi.fn().mockReturnValue(mockDatabaseProvider),
}));

// Mock Supabase client for tests
const mockSupabaseClient = {
  auth: {
    getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    onAuthStateChange: vi.fn().mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    }),
  },
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: null, error: null }),
};

// Mock Supabase client creation
vi.mock("~/lib/supabase/client", () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

vi.mock("~/lib/supabase/server", () => ({
  createServerClient: vi.fn(() => mockSupabaseClient),
}));

// Mock auth provider context
vi.mock("~/app/auth-provider", () => ({
  useAuthContext: vi.fn(() => ({
    user: null,
    loading: false,
  })),
  AuthProvider: vi.fn(
    ({ children }: { children: React.ReactNode }) => children,
  ),
}));

// Mock auth permissions functions
vi.mock("~/server/auth/permissions", async () => {
  const actual = await vi.importActual("~/server/auth/permissions");
  return {
    ...actual,
    getUserPermissionsForSupabaseUser: vi.fn().mockResolvedValue([]),
    requirePermissionForSession: vi.fn().mockResolvedValue(undefined),
  };
});

// Mock tRPC to prevent server-side imports
vi.mock("~/trpc/react", () => ({
  api: {
    Provider: vi.fn(({ children }: { children: React.ReactNode }) => children),
    createClient: vi.fn(() => ({})),
    user: {
      getCurrentMembership: {
        useQuery: vi.fn(() => ({
          data: null,
          isLoading: false,
          error: null,
        })),
      },
    },
  },
}));

// Mock Next.js server APIs for tests
global.Request = vi
  .fn()
  .mockImplementation((input: string, init?: RequestInit) => ({
    url: input,
    method: init?.method ?? "GET",
    headers: new Map(Object.entries(init?.headers ?? {})),
    signal: init?.signal, // Properly forward AbortSignal for tRPC compatibility
    json: vi.fn().mockResolvedValue({}),
    text: vi.fn().mockResolvedValue(""),
  })) as unknown as typeof Request;

global.Response = {
  json: vi.fn().mockResolvedValue({}),
  error: vi.fn(),
  redirect: vi.fn(),
  new: vi
    .fn()
    .mockImplementation((body?: BodyInit | null, init?: ResponseInit) => ({
      ok: true,
      status: init?.status ?? 200,
      json: vi.fn().mockResolvedValue(body),
      text: vi.fn().mockResolvedValue(body ? JSON.stringify(body) : ""),
    })),
} as unknown as {
  new (body?: BodyInit | null, init?: ResponseInit): Response;
  prototype: Response;
  error(): Response;
  json(data: unknown, init?: ResponseInit): Response;
  redirect(url: string, status?: number): Response;
};

// Mock NextResponse
vi.mock("next/server", () => ({
  NextResponse: {
    json: vi.fn().mockImplementation((data: unknown, init?: ResponseInit) => ({
      json: vi.fn().mockResolvedValue(data),
      status: init?.status ?? 200,
    })),
  },
}));

// Reset all mocks after each test
afterEach(() => {
  vi.clearAllMocks();
});
