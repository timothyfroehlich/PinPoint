import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Mock environment variables for testing
Object.defineProperty(process.env, "NODE_ENV", {
  value: "test",
  writable: true,
  configurable: true,
});
process.env.AUTH_SECRET = "test-auth-secret";
process.env.NEXTAUTH_SECRET = "test-auth-secret"; // Alternative name
process.env.GOOGLE_CLIENT_ID = "test-google-client-id";
process.env.GOOGLE_CLIENT_SECRET = "test-google-client-secret";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.OPDB_API_URL = "https://opdb.org/api";
process.env.DEFAULT_ORG_SUBDOMAIN = "apc";
process.env.OPDB_API_KEY = "test-token";
process.env.IMAGE_STORAGE_PROVIDER = "local";
process.env.NEXTAUTH_URL = "http://localhost:3000";
process.env.VERCEL_URL = "";
process.env.PORT = "3000";

// Mock fetch globally for tests
global.fetch = vi.fn();

// Mock env.js module to prevent server-side environment access in client tests
vi.mock("~/env.js", () => ({
  env: {
    NODE_ENV: "test",
    GOOGLE_CLIENT_ID: "test-google-client-id",
    GOOGLE_CLIENT_SECRET: "test-google-client-secret",
    NEXTAUTH_URL: "http://localhost:3000",
    NEXTAUTH_SECRET: "test-auth-secret",
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    OPDB_API_URL: "https://opdb.org/api",
    DEFAULT_ORG_SUBDOMAIN: "apc",
    OPDB_API_KEY: "test-token",
    IMAGE_STORAGE_PROVIDER: "local",
    VERCEL_URL: "",
    PORT: "3000",
  },
}));

// Create a mock Prisma client
const mockPrismaClient = {
  $disconnect: vi.fn().mockResolvedValue(undefined),
  organization: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  user: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  membership: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  issue: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  machine: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  location: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  attachment: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  model: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  issueStatus: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  priority: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  issueHistory: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  notification: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  pinballMapConfig: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    upsert: vi.fn(),
  },
};

// Mock database module
vi.mock("~/server/db", () => ({
  createPrismaClient: vi.fn().mockReturnValue(mockPrismaClient),
}));

// Mock database provider
const mockDatabaseProvider = {
  getClient: vi.fn().mockReturnValue(mockPrismaClient),
  disconnect: vi.fn().mockResolvedValue(undefined),
  reset: vi.fn(),
};

vi.mock("~/server/db/provider", () => ({
  DatabaseProvider: vi.fn().mockImplementation(() => mockDatabaseProvider),
  getGlobalDatabaseProvider: vi.fn().mockReturnValue(mockDatabaseProvider),
}));

// Mock NextAuth first to avoid import issues
vi.mock("next-auth", () => ({
  default: vi.fn().mockImplementation(() => ({
    auth: vi.fn(),
    handlers: { GET: vi.fn(), POST: vi.fn() },
    signIn: vi.fn(),
    signOut: vi.fn(),
  })),
}));

// Mock NextAuth React hooks
vi.mock("next-auth/react", () => ({
  useSession: vi.fn(() => ({
    data: null,
    status: "loading",
  })),
  signIn: vi.fn(),
  signOut: vi.fn(),
  SessionProvider: vi.fn(
    ({ children }: { children: React.ReactNode }) => children,
  ),
}));

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
