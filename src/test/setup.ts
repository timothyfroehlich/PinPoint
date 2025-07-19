import "@testing-library/jest-dom";

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
global.fetch = jest.fn();

// Create a mock Prisma client
const mockPrismaClient = {
  $disconnect: jest.fn().mockResolvedValue(undefined),
  organization: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  membership: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  issue: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  machine: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  location: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  attachment: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  model: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  issueStatus: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  priority: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  issueHistory: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  notification: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  pinballMapConfig: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    upsert: jest.fn(),
  },
};

// Mock database module
jest.mock("~/server/db", () => ({
  createPrismaClient: jest.fn().mockReturnValue(mockPrismaClient),
}));

// Mock database provider
const mockDatabaseProvider = {
  getClient: jest.fn().mockReturnValue(mockPrismaClient),
  disconnect: jest.fn().mockResolvedValue(undefined),
  reset: jest.fn(),
};

jest.mock("~/server/db/provider", () => ({
  DatabaseProvider: jest.fn().mockImplementation(() => mockDatabaseProvider),
  getGlobalDatabaseProvider: jest.fn().mockReturnValue(mockDatabaseProvider),
}));

// Mock NextAuth first to avoid import issues
jest.mock("next-auth", () => {
  return jest.fn().mockImplementation(() => ({
    auth: jest.fn(),
    handlers: { GET: jest.fn(), POST: jest.fn() },
    signIn: jest.fn(),
    signOut: jest.fn(),
  }));
});

// Mock Next.js server APIs for tests
global.Request = jest.fn().mockImplementation((input, init) => ({
  url: input,
  method: init?.method ?? "GET",
  headers: new Map(Object.entries(init?.headers ?? {})),
  json: jest.fn().mockResolvedValue({}),
  text: jest.fn().mockResolvedValue(""),
}));

global.Response = {
  json: jest.fn().mockResolvedValue({}),
  error: jest.fn(),
  redirect: jest.fn(),
  new: jest.fn().mockImplementation((body, init) => ({
    ok: true,
    status: init?.status ?? 200,
    json: jest.fn().mockResolvedValue(body),
    text: jest.fn().mockResolvedValue(String(body)),
  })),
} as unknown as {
  new (body?: BodyInit | null, init?: ResponseInit): Response;
  prototype: Response;
  error(): Response;
  json(data: unknown, init?: ResponseInit): Response;
  redirect(url: string, status?: number): Response;
};

// Mock NextResponse
jest.mock("next/server", () => ({
  NextResponse: {
    json: jest.fn().mockImplementation((data, init) => ({
      json: jest.fn().mockResolvedValue(data),
      status: init?.status ?? 200,
    })),
  },
}));

// Reset all mocks after each test
afterEach(() => {
  jest.clearAllMocks();
});
