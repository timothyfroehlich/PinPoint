import { type Role } from "@prisma/client";

import { GET } from "../users/route";

// Mock the database with proper typing
const mockUserFindMany = jest.fn();
const mockMembershipFindMany = jest.fn();
const mockOrganizationFindMany = jest.fn();

jest.mock("~/server/db", () => ({
  db: {
    organization: {
      findMany: mockOrganizationFindMany,
    },
    user: {
      findMany: mockUserFindMany,
    },
    membership: {
      findMany: mockMembershipFindMany,
    },
  },
}));

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
  role: Role;
}

interface TestOrganization {
  id: string;
  name: string;
  subdomain: string;
  logoUrl: string | null;
}

// Helper to mock NODE_ENV safely
function setTestEnv(env: string): void {
  const originalEnv = process.env.NODE_ENV;
  Object.defineProperty(process.env, "NODE_ENV", {
    value: env,
    configurable: true,
  });
  // Restore after test
  afterEach(() => {
    Object.defineProperty(process.env, "NODE_ENV", {
      value: originalEnv,
      configurable: true,
    });
  });
}

describe("/api/dev/users", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
      email: "phoenixavatar2@gmail.com",
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
      mockOrganizationFindMany.mockResolvedValue(mockOrganizations);
      mockUserFindMany.mockResolvedValue(mockUsers);
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
          role: Role;
        }[];
      };
      expect(data.users).toHaveLength(2);
      expect(data.users[0]).toEqual({
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

      mockOrganizationFindMany.mockResolvedValue(mockOrganizations);
      mockUserFindMany.mockResolvedValue(allUsers);
      mockMembershipFindMany.mockResolvedValue(mockMemberships);

      const response = await GET();

      expect(response.status).toBe(200);

      const data = (await response.json()) as {
        users: { email: string }[];
      };
      // Should only return test account users
      const emails = data.users.map((u) => u.email);
      expect(emails).toContain("roger.sharpe@testaccount.dev");
      expect(emails).toContain("phoenixavatar2@gmail.com");
      expect(emails).not.toContain("regular@example.com");
    });

    it("should handle database errors gracefully", async () => {
      mockOrganizationFindMany.mockRejectedValue(new Error("Database error"));

      const response = await GET();

      expect(response.status).toBe(500);
    });

    it("should include all required user fields", async () => {
      mockOrganizationFindMany.mockResolvedValue(mockOrganizations);
      mockUserFindMany.mockResolvedValue(mockUsers);
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
