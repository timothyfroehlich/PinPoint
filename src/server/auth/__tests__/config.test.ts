import { type NextAuthConfig } from "next-auth";
import { authConfig } from "../config";
import { db } from "~/server/db";

// Mock the database
jest.mock("~/server/db", () => ({
  db: {
    organization: {
      findUnique: jest.fn(),
    },
    membership: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}));

const mockDb = db as jest.Mocked<typeof db>;

describe("NextAuth Configuration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment
    process.env.NODE_ENV = "test";
  });

  describe("Provider Configuration", () => {
    it("should include Google provider", () => {
      expect(authConfig.providers).toHaveLength(2);
      const googleProvider = authConfig.providers[0];
      expect(googleProvider.id).toBe("google");
    });

    it("should include credentials provider in development", () => {
      process.env.NODE_ENV = "development";
      
      // Re-import to get fresh config with new NODE_ENV
      jest.resetModules();
      const { authConfig: devConfig } = require("../config");
      
      expect(devConfig.providers).toHaveLength(2);
      const credentialsProvider = devConfig.providers[1];
      expect(credentialsProvider.id).toBe("credentials");
      expect(credentialsProvider.name).toBe("Development Test Users");
    });

    it("should not include credentials provider in production", () => {
      process.env.NODE_ENV = "production";
      
      jest.resetModules();
      const { authConfig: prodConfig } = require("../config");
      
      expect(prodConfig.providers).toHaveLength(1);
      expect(prodConfig.providers[0].id).toBe("google");
    });
  });

  describe("Session Strategy", () => {
    it("should use JWT session strategy", () => {
      expect(authConfig.session?.strategy).toBe("jwt");
    });
  });

  describe("JWT Callback", () => {
    const mockUser = {
      id: "user-123",
      name: "Test User",
      email: "test@example.com",
    };

    const mockOrganization = {
      id: "org-123",
      name: "Test Org",
      subdomain: "apc",
    };

    const mockMembership = {
      id: "membership-123",
      role: "admin" as const,
      userId: "user-123",
      organizationId: "org-123",
    };

    beforeEach(() => {
      mockDb.organization.findUnique.mockResolvedValue(mockOrganization);
      mockDb.membership.findUnique.mockResolvedValue(mockMembership);
    });

    it("should add user ID and organization context to token", async () => {
      const token = {};
      
      const result = await authConfig.callbacks?.jwt?.({
        token,
        user: mockUser,
        trigger: "signIn",
        isNewUser: false,
        session: null,
        account: null,
      });

      expect(result).toEqual({
        id: "user-123",
        role: "admin",
        organizationId: "org-123",
      });
    });

    it("should query organization by APC subdomain", async () => {
      const token = {};
      
      await authConfig.callbacks?.jwt?.({
        token,
        user: mockUser,
        trigger: "signIn",
        isNewUser: false,
        session: null,
        account: null,
      });

      expect(mockDb.organization.findUnique).toHaveBeenCalledWith({
        where: { subdomain: "apc" },
      });
    });

    it("should query user membership for organization", async () => {
      const token = {};
      
      await authConfig.callbacks?.jwt?.({
        token,
        user: mockUser,
        trigger: "signIn",
        isNewUser: false,
        session: null,
        account: null,
      });

      expect(mockDb.membership.findUnique).toHaveBeenCalledWith({
        where: {
          userId_organizationId: {
            userId: "user-123",
            organizationId: "org-123",
          },
        },
      });
    });

    it("should handle user without organization membership", async () => {
      mockDb.membership.findUnique.mockResolvedValue(null);
      
      const token = {};
      
      const result = await authConfig.callbacks?.jwt?.({
        token,
        user: mockUser,
        trigger: "signIn",
        isNewUser: false,
        session: null,
        account: null,
      });

      expect(result).toEqual({
        id: "user-123",
      });
    });

    it("should handle missing organization", async () => {
      mockDb.organization.findUnique.mockResolvedValue(null);
      
      const token = {};
      
      const result = await authConfig.callbacks?.jwt?.({
        token,
        user: mockUser,
        trigger: "signIn",
        isNewUser: false,
        session: null,
        account: null,
      });

      expect(result).toEqual({
        id: "user-123",
      });
    });

    it("should not modify token when no user provided", async () => {
      const token = { existing: "data" };
      
      const result = await authConfig.callbacks?.jwt?.({
        token,
        user: null,
        trigger: "update",
        isNewUser: false,
        session: null,
        account: null,
      });

      expect(result).toEqual({ existing: "data" });
      expect(mockDb.organization.findUnique).not.toHaveBeenCalled();
    });
  });

  describe("Session Callback", () => {
    it("should transform JWT token data into session", async () => {
      const mockSession = {
        user: {
          name: "Test User",
          email: "test@example.com",
          image: "/avatar.jpg",
        },
        expires: new Date().toISOString(),
      };

      const mockToken = {
        id: "user-123",
        role: "admin",
        organizationId: "org-123",
      };

      const result = await authConfig.callbacks?.session?.({
        session: mockSession,
        token: mockToken,
        user: null,
        trigger: "update",
        newSession: null,
      });

      expect(result).toEqual({
        ...mockSession,
        user: {
          ...mockSession.user,
          id: "user-123",
          role: "admin",
          organizationId: "org-123",
        },
      });
    });

    it("should return original session when no token provided", async () => {
      const mockSession = {
        user: {
          name: "Test User",
          email: "test@example.com",
        },
        expires: new Date().toISOString(),
      };

      const result = await authConfig.callbacks?.session?.({
        session: mockSession,
        token: null,
        user: null,
        trigger: "update",
        newSession: null,
      });

      expect(result).toEqual(mockSession);
    });
  });

  describe("Credentials Provider Authorization", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "development";
    });

    it("should authorize valid user in development", async () => {
      const mockUser = {
        id: "user-123",
        name: "Test User",
        email: "test@testaccount.dev",
        profilePicture: "/avatar.jpg",
      };

      mockDb.user.findUnique.mockResolvedValue(mockUser);

      // Get the credentials provider
      jest.resetModules();
      const { authConfig: devConfig } = require("../config");
      const credentialsProvider = devConfig.providers[1];

      const result = await credentialsProvider.authorize({
        email: "test@testaccount.dev",
      });

      expect(result).toEqual({
        id: "user-123",
        name: "Test User",
        email: "test@testaccount.dev",
        image: "/avatar.jpg",
      });
    });

    it("should reject authorization in production", async () => {
      process.env.NODE_ENV = "production";

      jest.resetModules();
      const { authConfig: prodConfig } = require("../config");
      const credentialsProvider = prodConfig.providers.find((p: any) => p.id === "credentials");

      if (credentialsProvider) {
        const result = await credentialsProvider.authorize({
          email: "test@testaccount.dev",
        });

        expect(result).toBeNull();
      } else {
        // Credentials provider should not exist in production
        expect(credentialsProvider).toBeUndefined();
      }
    });

    it("should reject invalid email format", async () => {
      jest.resetModules();
      const { authConfig: devConfig } = require("../config");
      const credentialsProvider = devConfig.providers[1];

      const result = await credentialsProvider.authorize({
        email: "",
      });

      expect(result).toBeNull();
      expect(mockDb.user.findUnique).not.toHaveBeenCalled();
    });

    it("should reject non-existent user", async () => {
      mockDb.user.findUnique.mockResolvedValue(null);

      jest.resetModules();
      const { authConfig: devConfig } = require("../config");
      const credentialsProvider = devConfig.providers[1];

      const result = await credentialsProvider.authorize({
        email: "nonexistent@testaccount.dev",
      });

      expect(result).toBeNull();
    });
  });

  describe("Configuration Validation", () => {
    it("should have valid NextAuth configuration", () => {
      expect(authConfig).toBeDefined();
      expect(authConfig.providers).toBeDefined();
      expect(authConfig.adapter).toBeDefined();
      expect(authConfig.session).toBeDefined();
      expect(authConfig.callbacks).toBeDefined();
      expect(authConfig.pages).toBeDefined();
    });

    it("should have custom sign-in page configured", () => {
      expect(authConfig.pages?.signIn).toBe("/sign-in");
    });

    it("should use PrismaAdapter", () => {
      expect(authConfig.adapter).toBeDefined();
      // Note: We can't easily test the adapter without more complex mocking
    });
  });
});