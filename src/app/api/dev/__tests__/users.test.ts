import { GET } from "../users/route";
import { NextRequest } from "next/server";
import { db } from "~/server/db";

// Mock the database
jest.mock("~/server/db", () => ({
  db: {
    organization: {
      findMany: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
    membership: {
      findMany: jest.fn(),
    },
  },
}));

const mockDb = db as jest.Mocked<typeof db>;

describe("/api/dev/users", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set to development mode by default
    process.env.NODE_ENV = "development";
  });

  afterEach(() => {
    // Reset NODE_ENV
    process.env.NODE_ENV = "test";
  });

  const mockOrganizations = [
    {
      id: "org-1",
      name: "Test Organization",
      subdomain: "test",
    },
  ];

  const mockUsers = [
    {
      id: "user-1",
      name: "Roger Sharpe",
      email: "roger.sharpe@testaccount.dev",
      bio: "Pinball ambassador and historian.",
      profilePicture: "/images/default-avatars/default-avatar-1.webp",
      joinDate: new Date("2024-01-01"),
      emailVerified: null,
      image: null,
    },
    {
      id: "user-2",
      name: "Gary Stern",
      email: "gary.stern@testaccount.dev",
      bio: "Founder of Stern Pinball.",
      profilePicture: "/images/default-avatars/default-avatar-2.webp",
      joinDate: new Date("2024-01-02"),
      emailVerified: null,
      image: null,
    },
    {
      id: "user-3",
      name: "Escher Lefkoff",
      email: "escher.lefkoff@testaccount.dev",
      bio: "World champion competitive pinball player.",
      profilePicture: "/images/default-avatars/default-avatar-3.webp",
      joinDate: new Date("2024-01-03"),
      emailVerified: null,
      image: null,
    },
  ];

  const mockMemberships = [
    {
      id: "membership-1",
      role: "admin",
      userId: "user-1",
      organizationId: "org-1",
    },
    {
      id: "membership-2",
      role: "member",
      userId: "user-2",
      organizationId: "org-1",
    },
    {
      id: "membership-3",
      role: "player",
      userId: "user-3",
      organizationId: "org-1",
    },
  ];

  const createRequest = (url = "http://localhost:3000/api/dev/users") => {
    return new NextRequest(url);
  };

  describe("Development Environment", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "development";
      mockDb.organization.findMany.mockResolvedValue(mockOrganizations);
      mockDb.user.findMany.mockResolvedValue(mockUsers);
      mockDb.membership.findMany.mockResolvedValue(mockMemberships);
    });

    it("should return test users with roles in development", async () => {
      const request = createRequest();
      const response = await GET(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toEqual({
        users: [
          {
            id: "user-1",
            name: "Roger Sharpe",
            email: "roger.sharpe@testaccount.dev",
            bio: "Pinball ambassador and historian.",
            profilePicture: "/images/default-avatars/default-avatar-1.webp",
            role: "admin",
          },
          {
            id: "user-2",
            name: "Gary Stern",
            email: "gary.stern@testaccount.dev",
            bio: "Founder of Stern Pinball.",
            profilePicture: "/images/default-avatars/default-avatar-2.webp",
            role: "member",
          },
          {
            id: "user-3",
            name: "Escher Lefkoff",
            email: "escher.lefkoff@testaccount.dev",
            bio: "World champion competitive pinball player.",
            profilePicture: "/images/default-avatars/default-avatar-3.webp",
            role: "player",
          },
        ],
      });
    });

    it("should query database correctly", async () => {
      const request = createRequest();
      await GET(request);

      expect(mockDb.organization.findMany).toHaveBeenCalledWith({
        take: 1,
      });

      expect(mockDb.user.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { email: { contains: "@testaccount.dev" } },
            { email: "phoenixavatar2@gmail.com" },
          ],
        },
      });

      expect(mockDb.membership.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: "org-1",
          userId: { in: ["user-1", "user-2", "user-3"] },
        },
      });
    });

    it("should handle users without memberships", async () => {
      // Return empty memberships
      mockDb.membership.findMany.mockResolvedValue([]);

      const request = createRequest();
      const response = await GET(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.users).toHaveLength(3);
      
      // Users without membership should have role undefined
      data.users.forEach((user: any) => {
        expect(user.role).toBeUndefined();
      });
    });

    it("should handle missing organization", async () => {
      mockDb.organization.findMany.mockResolvedValue([]);

      const request = createRequest();
      const response = await GET(request);

      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data).toEqual({
        error: "No organization found. Please run the seed script.",
      });
    });

    it("should handle database errors gracefully", async () => {
      mockDb.user.findMany.mockRejectedValue(new Error("Database connection failed"));

      const request = createRequest();
      const response = await GET(request);

      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data).toEqual({
        error: "Failed to fetch development users",
      });
    });

    it("should include project owner email", async () => {
      // Add project owner to mock users
      const usersWithOwner = [
        ...mockUsers,
        {
          id: "user-owner",
          name: "Tim Froehlich",
          email: "phoenixavatar2@gmail.com",
          bio: "Project owner.",
          profilePicture: "/images/default-avatars/default-avatar-4.webp",
          joinDate: new Date("2024-01-04"),
          emailVerified: null,
          image: null,
        },
      ];

      const membershipsWithOwner = [
        ...mockMemberships,
        {
          id: "membership-owner",
          role: "admin",
          userId: "user-owner",
          organizationId: "org-1",
        },
      ];

      mockDb.user.findMany.mockResolvedValue(usersWithOwner);
      mockDb.membership.findMany.mockResolvedValue(membershipsWithOwner);

      const request = createRequest();
      const response = await GET(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.users).toHaveLength(4);
      
      const ownerUser = data.users.find((u: any) => u.email === "phoenixavatar2@gmail.com");
      expect(ownerUser).toBeDefined();
      expect(ownerUser.name).toBe("Tim Froehlich");
      expect(ownerUser.role).toBe("admin");
    });

    it("should handle users with null profile pictures", async () => {
      const usersWithNullPictures = mockUsers.map(user => ({
        ...user,
        profilePicture: null,
      }));

      mockDb.user.findMany.mockResolvedValue(usersWithNullPictures);

      const request = createRequest();
      const response = await GET(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      data.users.forEach((user: any) => {
        expect(user.profilePicture).toBeNull();
      });
    });
  });

  describe("Production Environment", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "production";
    });

    it("should return 404 in production", async () => {
      const request = createRequest();
      const response = await GET(request);

      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data).toEqual({
        error: "Not found",
      });

      // Should not call database in production
      expect(mockDb.organization.findMany).not.toHaveBeenCalled();
      expect(mockDb.user.findMany).not.toHaveBeenCalled();
      expect(mockDb.membership.findMany).not.toHaveBeenCalled();
    });
  });

  describe("Test Environment", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "test";
    });

    it("should return 404 in test environment", async () => {
      const request = createRequest();
      const response = await GET(request);

      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data).toEqual({
        error: "Not found",
      });
    });
  });

  describe("Response Format", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "development";
      mockDb.organization.findMany.mockResolvedValue(mockOrganizations);
      mockDb.user.findMany.mockResolvedValue(mockUsers);
      mockDb.membership.findMany.mockResolvedValue(mockMemberships);
    });

    it("should return correct Content-Type header", async () => {
      const request = createRequest();
      const response = await GET(request);

      expect(response.headers.get("Content-Type")).toBe("application/json");
    });

    it("should include all required user fields", async () => {
      const request = createRequest();
      const response = await GET(request);
      const data = await response.json();

      data.users.forEach((user: any) => {
        expect(user).toHaveProperty("id");
        expect(user).toHaveProperty("name");
        expect(user).toHaveProperty("email");
        expect(user).toHaveProperty("bio");
        expect(user).toHaveProperty("profilePicture");
        expect(user).toHaveProperty("role");
        
        // Should not include sensitive fields
        expect(user).not.toHaveProperty("joinDate");
        expect(user).not.toHaveProperty("emailVerified");
        expect(user).not.toHaveProperty("image");
      });
    });

    it("should maintain consistent user ordering", async () => {
      const request = createRequest();
      const response = await GET(request);
      const data = await response.json();

      // Should return users in the same order as database query
      expect(data.users[0].email).toBe("roger.sharpe@testaccount.dev");
      expect(data.users[1].email).toBe("gary.stern@testaccount.dev");
      expect(data.users[2].email).toBe("escher.lefkoff@testaccount.dev");
    });
  });

  describe("Security", () => {
    it("should only return test account users", async () => {
      // Add a regular user that shouldn't be returned
      const allUsers = [
        ...mockUsers,
        {
          id: "user-regular",
          name: "Regular User",
          email: "regular@example.com", // Not a test account
          bio: "Regular user",
          profilePicture: null,
          joinDate: new Date("2024-01-05"),
          emailVerified: null,
          image: null,
        },
      ];

      mockDb.user.findMany.mockResolvedValue(allUsers);

      const request = createRequest();
      const response = await GET(request);
      const data = await response.json();

      // Should only return test account users
      expect(data.users).toHaveLength(3);
      expect(data.users.every((u: any) => u.email.includes("@testaccount.dev"))).toBe(true);
    });

    it("should not expose internal database structure", async () => {
      const request = createRequest();
      const response = await GET(request);
      const data = await response.json();

      // Response should be clean, not exposing internal Prisma structure
      expect(data).toEqual({
        users: expect.any(Array),
      });

      data.users.forEach((user: any) => {
        // Should not include Prisma-specific fields
        expect(user).not.toHaveProperty("_count");
        expect(user).not.toHaveProperty("memberships");
        expect(user).not.toHaveProperty("issues");
      });
    });
  });
});