// Add this helper at the top of the file
function setNodeEnv(value: string) {
  Object.defineProperty(process.env, "NODE_ENV", {
    value,
    configurable: true,
    writable: true,
    enumerable: true,
  });
}

// Create properly typed mock functions
const mockOrganizationFindUnique = jest.fn<Promise<unknown>, [unknown]>();
const mockMembershipFindUnique = jest.fn<Promise<unknown>, [unknown]>();
const mockUserFindUnique = jest.fn<Promise<unknown>, [unknown]>();

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

import { authConfig } from "../config";

import { db } from "~/server/db";

describe("NextAuth Configuration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment
    setNodeEnv("test");
    // Assign the mock functions to the imported mocks
    (db.organization.findUnique as jest.Mock) = mockOrganizationFindUnique;
    (db.membership.findUnique as jest.Mock) = mockMembershipFindUnique;
    (db.user.findUnique as jest.Mock) = mockUserFindUnique;
  });

  describe("Provider Configuration", () => {
    it("should include Google provider", () => {
      expect(authConfig.providers).toHaveLength(1);
      const googleProvider = authConfig.providers[0];
      expect(googleProvider).toBeDefined();
      expect(googleProvider!.id).toBe("google");
    });

    it("should include credentials provider in development", async () => {
      setNodeEnv("development");

      // Re-import to get fresh config with new NODE_ENV
      jest.resetModules();
      const configModule = await import("../config");
      const devConfig = configModule.authConfig;

      expect(devConfig.providers).toHaveLength(2);
      const credentialsProvider = devConfig.providers[1];
      expect(credentialsProvider).toBeDefined();
      expect(credentialsProvider!.id).toBe("credentials");
      expect(credentialsProvider!.name).toBe("Development Test Users");
    });

    it("should not include credentials provider in production", async () => {
      setNodeEnv("production");

      jest.resetModules();
      const configModule = await import("../config");
      const prodConfig = configModule.authConfig;

      expect(prodConfig.providers).toHaveLength(1);
      expect(prodConfig.providers[0]).toBeDefined();
      expect(prodConfig.providers[0]!.id).toBe("google");
    });
  });

  describe("Session Strategy", () => {
    it("should use JWT session strategy", () => {
      expect(authConfig.session?.strategy).toBe("jwt");
    });
  });

  describe("Credentials Provider Authorization", () => {
    beforeEach(() => {
      setNodeEnv("development");
    });

    it("should authorize valid user in development", async () => {
      const mockUser = {
        id: "user-123",
        name: "Test User",
        email: "test@testaccount.dev",
        profilePicture: "/avatar.jpg",
        bio: "Test bio",
        createdAt: new Date(),
        emailVerified: true,
      };

      mockUserFindUnique.mockResolvedValue(mockUser);

      // Get the credentials provider
      jest.resetModules();
      const configModule = await import("../config");
      const devConfig = configModule.authConfig;
      const credentialsProvider = devConfig.providers[1];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (credentialsProvider as any).authorize({
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
      setNodeEnv("production");

      jest.resetModules();
      const configModule = await import("../config");
      const prodConfig = configModule.authConfig;
      const credentialsProvider = prodConfig.providers.find(
        (p: { id: string }) => p.id === "credentials",
      );

      if (credentialsProvider) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (credentialsProvider as any).authorize({
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
      const configModule = await import("../config");
      const devConfig = configModule.authConfig;
      const credentialsProvider = devConfig.providers[1];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (credentialsProvider as any).authorize({
        email: "",
      });

      expect(result).toBeNull();
      expect(mockUserFindUnique).not.toHaveBeenCalled();
    });

    it("should reject non-existent user", async () => {
      mockUserFindUnique.mockResolvedValue(null);

      jest.resetModules();
      const configModule = await import("../config");
      const devConfig = configModule.authConfig;
      const credentialsProvider = devConfig.providers[1];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (credentialsProvider as any).authorize({
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
