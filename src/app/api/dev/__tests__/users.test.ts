/* eslint-disable @typescript-eslint/no-explicit-any */
// Mock the database with proper typing
const mockUserFindMany = jest.fn();
const mockMembershipFindMany = jest.fn();
const mockOrganizationFindMany = jest.fn();
const mockOrganizationFindFirst = jest.fn();

// Mock database provider
const mockDb = {
  organization: {
    findMany: mockOrganizationFindMany,
    findFirst: mockOrganizationFindFirst,
  },
  user: {
    findMany: mockUserFindMany,
  },
  membership: {
    findMany: mockMembershipFindMany,
  },
};

jest.mock("~/server/db/provider", () => ({
  getGlobalDatabaseProvider: jest.fn().mockReturnValue({
    getClient: jest.fn().mockReturnValue(mockDb),
    disconnect: jest.fn(),
    reset: jest.fn(),
  }),
}));

// Mock the env module
const mockEnv = {
  NODE_ENV: "development",
};

jest.mock("~/env.js", () => ({
  env: mockEnv,
}));

// Mock NextResponse
const mockNextResponseInstance = {
  json: jest.fn().mockImplementation(function (this: any) {
    return Promise.resolve(this.data);
  }),
  status: 200,
};

const mockNextResponse = jest.fn().mockImplementation((body, options) => ({
  ...mockNextResponseInstance,
  data: body,
  status: options?.status || 200,
}));

(mockNextResponse as any).json = jest.fn((data, options) => ({
  ...mockNextResponseInstance,
  data,
  status: options?.status || 200,
}));

jest.mock("next/server", () => ({
  NextResponse: mockNextResponse,
}));

// Mock the auth module
jest.mock("~/server/auth", () => ({
  auth: jest.fn(),
}));

import { GET } from "../users/route";

import { auth } from "~/server/auth";

interface TestUser {
  id: string;
  name: string;
  email: string;
  bio: string | null;
  profilePicture: string | null;
  joinDate: Date;
  emailVerified: Date | null;
  image: string | null;
}

interface TestMembership {
  userId: string;
  organizationId: string;
  role: string;
}

interface TestOrganization {
  id: string;
  name: string;
  subdomain: string;
  logoUrl: string | null;
}

// Helper to mock NODE_ENV safely
function setTestEnv(env: string): void {
  mockEnv.NODE_ENV = env;
}

describe("/api/dev/users", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setTestEnv("development");
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "user-1", name: "Test User" },
    });
  });

  afterEach(() => {
    setTestEnv("development");
  });

  const mockOrganizations: TestOrganization[] = [
    {
      id: "org-1",
      name: "Test Organization",
      subdomain: "test",
      logoUrl: null,
    },
  ];

  const mockUsers: TestUser[] = [
    {
      id: "user-1",
      name: "Roger Sharpe",
      email: "roger.sharpe@testaccount.dev",
      bio: "Pinball ambassador and historian.",
      profilePicture: "/images/default-avatars/default-avatar-1.webp",
      joinDate: new Date("2023-01-01"),
      emailVerified: new Date("2023-01-01"),
      image: null,
    },
    {
      id: "user-2",
      name: "Tim Froehlich",
      email: "email9@example.com",
      bio: "Project owner.",
      profilePicture: "/images/default-avatars/default-avatar-2.webp",
      joinDate: new Date("2023-01-01"),
      emailVerified: new Date("2023-01-01"),
      image: null,
    },
  ];

  const mockMemberships: TestMembership[] = [
    {
      userId: "user-1",
      organizationId: "org-1",
      role: "admin",
    },
    {
      userId: "user-2",
      organizationId: "org-1",
      role: "admin",
    },
  ];

  describe("GET /api/dev/users", () => {
    it("should return dev users in development environment", async () => {
      // Setup mocks
      mockOrganizationFindFirst.mockResolvedValue(mockOrganizations[0]);
      mockUserFindMany.mockResolvedValue(
        mockUsers.map((user) => ({
          ...user,
          memberships: [
            {
              role: { name: "admin" },
            },
          ],
        })),
      );
      mockMembershipFindMany.mockResolvedValue(mockMemberships);

      const response = await GET();

      expect(response.status).toBe(200);

      const data = (await response.json()) as {
        users: {
          id: string;
          name: string;
          email: string;
          bio: string | null;
          profilePicture: string | null;
          role: string;
        }[];
      };
      expect(data.users).toHaveLength(2);
      expect(data.users[0]).toMatchObject({
        id: "user-1",
        name: "Roger Sharpe",
        email: "roger.sharpe@testaccount.dev",
        bio: "Pinball ambassador and historian.",
        profilePicture: "/images/default-avatars/default-avatar-1.webp",
        role: "admin",
      });
    });

    it("should return 404 in production environment", async () => {
      setTestEnv("production");

      const response = await GET();

      expect(response.status).toBe(404);
    });

    it("should filter to test account users only", async () => {
      const allUsers: TestUser[] = [
        ...mockUsers,
        {
          id: "user-3",
          name: "Regular User",
          email: "regular@example.com",
          bio: "Not a test user",
          profilePicture: null,
          joinDate: new Date("2023-01-01"),
          emailVerified: new Date("2023-01-01"),
          image: null,
        },
      ];

      mockOrganizationFindFirst.mockResolvedValue(mockOrganizations[0]);
      mockUserFindMany.mockResolvedValue(
        allUsers.slice(0, 2).map((user) => ({
          ...user,
          memberships: [
            {
              role: { name: "admin" },
            },
          ],
        })),
      );
      mockMembershipFindMany.mockResolvedValue(mockMemberships);

      const response = await GET();

      expect(response.status).toBe(200);

      const data = (await response.json()) as {
        users: { email: string }[];
      };
      // Should only return test account users
      const emails = data.users.map((u) => u.email);
      expect(emails).toContain("roger.sharpe@testaccount.dev");
      expect(emails).toContain("email9@example.com");
      expect(emails).not.toContain("regular@example.com");
    });

    it("should handle database errors gracefully", async () => {
      mockOrganizationFindFirst.mockRejectedValue(new Error("Database error"));

      const response = await GET();

      expect(response.status).toBe(500);
    });

    it("should include all required user fields", async () => {
      mockOrganizationFindFirst.mockResolvedValue(mockOrganizations[0]);
      mockUserFindMany.mockResolvedValue(
        mockUsers.map((user) => ({
          ...user,
          memberships: [
            {
              role: { name: "admin" },
            },
          ],
        })),
      );
      mockMembershipFindMany.mockResolvedValue(mockMemberships);

      const response = await GET();

      expect(response.status).toBe(200);

      const data = (await response.json()) as {
        users: Record<string, unknown>[];
      };
      const user = data.users[0];

      expect(user).toHaveProperty("id");
      expect(user).toHaveProperty("name");
      expect(user).toHaveProperty("email");
      expect(user).toHaveProperty("bio");
      expect(user).toHaveProperty("profilePicture");
      expect(user).toHaveProperty("role");
    });
  });
});
