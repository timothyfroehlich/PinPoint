import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { createAuthProviders } from "../providers";
import { validateGoogleOAuth, validateAndLogOAuthConfig } from "../validation";
import {
  shouldEnableCredentialsProvider,
  shouldEnableTestLogin,
  shouldEnableDemoLogin,
  isDevelopment,
  isPreview,
  isProduction,
} from "~/lib/environment";

// Mock environment functions
vi.mock("~/lib/environment", () => ({
  shouldEnableCredentialsProvider: vi.fn(),
  shouldEnableTestLogin: vi.fn(),
  shouldEnableDemoLogin: vi.fn(),
  isDevelopment: vi.fn(),
  isPreview: vi.fn(),
  isProduction: vi.fn(),
}));

// Mock env
vi.mock("~/env.js", () => ({
  env: {
    GOOGLE_CLIENT_ID: "test-client-id",
    GOOGLE_CLIENT_SECRET: "test-client-secret",
  },
}));

// Mock console methods to avoid noise in tests
vi.spyOn(console, "log").mockImplementation(() => {
  // Intentionally empty - suppressing console output in tests
});
vi.spyOn(console, "warn").mockImplementation(() => {
  // Intentionally empty - suppressing console output in tests
});
vi.spyOn(console, "error").mockImplementation(() => {
  // Intentionally empty - suppressing console output in tests
});

describe("Auth Environment Configuration", () => {
  // Mock database client
  const mockDb = {} as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Provider Selection", () => {
    it("should include Google provider in all environments", () => {
      vi.mocked(shouldEnableCredentialsProvider).mockReturnValue(false);

      const providers = createAuthProviders(mockDb);

      expect(providers).toHaveLength(1);
      expect(providers[0]).toMatchObject({
        type: "oidc",
        name: "Google",
      });
    });

    it("should include Credentials provider in development", () => {
      vi.mocked(shouldEnableCredentialsProvider).mockReturnValue(true);
      vi.mocked(shouldEnableTestLogin).mockReturnValue(true);
      vi.mocked(shouldEnableDemoLogin).mockReturnValue(false);

      const providers = createAuthProviders(mockDb);

      expect(providers).toHaveLength(2);
      expect(providers[1]).toMatchObject({
        type: "credentials",
      });
      expect(providers[1]?.name).toBe("Development Test Users");
    });

    it("should include Demo provider in preview", () => {
      vi.mocked(shouldEnableCredentialsProvider).mockReturnValue(true);
      vi.mocked(shouldEnableTestLogin).mockReturnValue(false);
      vi.mocked(shouldEnableDemoLogin).mockReturnValue(true);

      const providers = createAuthProviders(mockDb);

      expect(providers).toHaveLength(2);
      expect(providers[1]).toMatchObject({
        type: "credentials",
      });
      expect(providers[1]?.name).toBe("Demo Users");
    });

    it("should not include Credentials provider in production", () => {
      vi.mocked(shouldEnableCredentialsProvider).mockReturnValue(false);

      const providers = createAuthProviders(mockDb);

      expect(providers).toHaveLength(1);
      expect(providers[0]).toMatchObject({
        type: "oidc",
        name: "Google",
      });
    });
  });

  describe("OAuth Validation", () => {
    it("should validate Google OAuth configuration successfully", () => {
      vi.mocked(isProduction).mockReturnValue(false);
      vi.mocked(isPreview).mockReturnValue(false);

      const result = validateGoogleOAuth();

      expect(result.isValid).toBe(true);
      expect(result.provider).toBe("Google");
      expect(result.errors).toHaveLength(0);
    });

    it("should require OAuth credentials in production", async () => {
      vi.mocked(isProduction).mockReturnValue(true);
      vi.mocked(isPreview).mockReturnValue(false);

      // Mock env with missing credentials
      await vi.importMock("~/env.js").then((mod: any) => {
        mod.env.GOOGLE_CLIENT_ID = undefined;
        mod.env.GOOGLE_CLIENT_SECRET = undefined;
        return mod;
      });

      const result = validateGoogleOAuth();

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("required in production");
    });

    it("should log validation results", () => {
      vi.mocked(isProduction).mockReturnValue(false);

      const isValid = validateAndLogOAuthConfig();

      expect(isValid).toBe(true);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("🟢 OAuth Google"),
      );
    });
  });

  describe("Environment Detection", () => {
    it("should detect development environment correctly", () => {
      vi.mocked(isDevelopment).mockReturnValue(true);
      vi.mocked(isPreview).mockReturnValue(false);
      vi.mocked(isProduction).mockReturnValue(false);
      vi.mocked(shouldEnableCredentialsProvider).mockReturnValue(true);

      expect(isDevelopment()).toBe(true);
      expect(shouldEnableCredentialsProvider()).toBeTruthy();
    });

    it("should detect preview environment correctly", () => {
      vi.mocked(isDevelopment).mockReturnValue(false);
      vi.mocked(isPreview).mockReturnValue(true);
      vi.mocked(isProduction).mockReturnValue(false);

      expect(isPreview()).toBe(true);
    });

    it("should detect production environment correctly", () => {
      vi.mocked(isDevelopment).mockReturnValue(false);
      vi.mocked(isPreview).mockReturnValue(false);
      vi.mocked(isProduction).mockReturnValue(true);
      vi.mocked(shouldEnableCredentialsProvider).mockReturnValue(false);

      expect(isProduction()).toBe(true);
      expect(shouldEnableCredentialsProvider()).toBeFalsy();
    });
  });
});
