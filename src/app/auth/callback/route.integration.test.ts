/**
 * Auth Callback Route Integration Tests
 * Testing OAuth callback processing, organization resolution, and rate limiting
 *
 * ARCHETYPE: Router Integration Test
 * - Tests Next.js API route handlers with mocked dependencies
 * - Validates request/response behavior and business logic
 * - Tests security features like rate limiting and organization validation
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

// Mock all external dependencies
vi.mock("~/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("~/lib/supabase/rls-helpers", () => ({
  updateUserOrganization: vi.fn(),
}));

vi.mock("~/lib/subdomain-verification", () => ({
  extractTrustedSubdomain: vi.fn(),
}));

vi.mock("~/lib/domain-org-mapping", () => ({
  resolveOrgSubdomainFromHost: vi.fn(),
}));

vi.mock("~/lib/dal/public-organizations", () => ({
  getOrganizationBySubdomain: vi.fn(),
  getUserMembershipPublic: vi.fn(),
}));

vi.mock("~/lib/rate-limit/inMemory", () => ({
  getInMemoryRateLimiter: vi.fn(),
}));

vi.mock("~/env", () => ({
  env: {
    NODE_ENV: "test",
  },
}));

// Import mocked modules
import { createClient } from "~/lib/supabase/server";
import { updateUserOrganization } from "~/lib/supabase/rls-helpers";
import { extractTrustedSubdomain } from "~/lib/subdomain-verification";
import { resolveOrgSubdomainFromHost } from "~/lib/domain-org-mapping";
import {
  getOrganizationBySubdomain,
  getUserMembershipPublic,
} from "~/lib/dal/public-organizations";
import { getInMemoryRateLimiter } from "~/lib/rate-limit/inMemory";

// Test data constants
const TEST_USER = {
  id: "test-user-123",
  email: "test@example.com",
  app_metadata: { organizationId: "old-org-id" },
};

const TEST_ORG = {
  id: "test-org-456",
  subdomain: "testorg",
  name: "Test Organization",
};

const TEST_MEMBERSHIP = {
  id: "membership-789",
  user_id: TEST_USER.id,
  organization_id: TEST_ORG.id,
  role: "member",
};

describe("Auth Callback Route (Router Integration)", () => {
  let mockSupabase: any;
  let mockRateLimiter: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup Supabase client mock
    mockSupabase = {
      auth: {
        exchangeCodeForSession: vi.fn(),
        getUser: vi.fn(),
      },
    };
    vi.mocked(createClient).mockResolvedValue(mockSupabase);

    // Setup rate limiter mock
    mockRateLimiter = {
      check: vi.fn().mockReturnValue(true), // Allow by default
    };
    vi.mocked(getInMemoryRateLimiter).mockReturnValue(mockRateLimiter);

    // Setup other mocks with defaults
    vi.mocked(extractTrustedSubdomain).mockReturnValue(null);
    vi.mocked(resolveOrgSubdomainFromHost).mockReturnValue(null);
    vi.mocked(getOrganizationBySubdomain).mockResolvedValue(null);
    vi.mocked(getUserMembershipPublic).mockResolvedValue(null);
    vi.mocked(updateUserOrganization).mockResolvedValue(undefined);
  });

  describe("Rate Limiting", () => {
    it("should block requests when rate limit exceeded", async () => {
      // Arrange: Rate limiter returns false (limit exceeded)
      mockRateLimiter.check.mockReturnValue(false);

      const request = new NextRequest(
        "http://localhost:3000/auth/callback?code=test123",
      );

      // Act
      const response = await GET(request);

      // Assert
      expect(response.status).toBe(307); // Next.js temporary redirect
      expect(response.headers.get("location")).toContain(
        "/auth/auth-code-error?error=rate_limited",
      );
      expect(mockRateLimiter.check).toHaveBeenCalledWith(
        "auth-callback:unknown",
        { windowMs: 15 * 60 * 1000, max: 10 },
      );
    });

    it("should extract client IP from x-forwarded-for header", async () => {
      // Arrange
      const request = new NextRequest(
        "http://localhost:3000/auth/callback?code=test123",
        {
          headers: { "x-forwarded-for": "192.168.1.100" },
        },
      );
      mockSupabase.auth.exchangeCodeForSession.mockResolvedValue({
        error: null,
      });
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: TEST_USER },
      });

      // Act
      await GET(request);

      // Assert
      expect(mockRateLimiter.check).toHaveBeenCalledWith(
        "auth-callback:192.168.1.100",
        expect.any(Object),
      );
    });

    it("should extract client IP from x-real-ip header as fallback", async () => {
      // Arrange
      const request = new NextRequest(
        "http://localhost:3000/auth/callback?code=test123",
        {
          headers: { "x-real-ip": "10.0.0.50" },
        },
      );
      mockSupabase.auth.exchangeCodeForSession.mockResolvedValue({
        error: null,
      });
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: TEST_USER },
      });

      // Act
      await GET(request);

      // Assert
      expect(mockRateLimiter.check).toHaveBeenCalledWith(
        "auth-callback:10.0.0.50",
        expect.any(Object),
      );
    });
  });

  describe("OAuth Code Exchange", () => {
    it("should exchange code for session successfully", async () => {
      // Arrange
      const request = new NextRequest(
        "http://localhost:3000/auth/callback?code=valid-code",
      );
      mockSupabase.auth.exchangeCodeForSession.mockResolvedValue({
        error: null,
      });
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: TEST_USER },
      });

      // Act
      const response = await GET(request);

      // Assert
      expect(mockSupabase.auth.exchangeCodeForSession).toHaveBeenCalledWith(
        "valid-code",
      );
      expect(response.status).toBe(307); // Next.js temporary redirect
    });

    it("should redirect to error page when code exchange fails", async () => {
      // Arrange
      const request = new NextRequest(
        "http://localhost:3000/auth/callback?code=invalid-code",
      );
      mockSupabase.auth.exchangeCodeForSession.mockResolvedValue({
        error: { message: "Invalid code" },
      });

      // Act
      const response = await GET(request);

      // Assert
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toContain(
        "/auth/auth-code-error",
      );
    });

    it("should redirect to error page when no code provided", async () => {
      // Arrange
      const request = new NextRequest("http://localhost:3000/auth/callback");

      // Act
      const response = await GET(request);

      // Assert
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toContain(
        "/auth/auth-code-error",
      );
      expect(mockSupabase.auth.exchangeCodeForSession).not.toHaveBeenCalled();
    });
  });

  describe("Organization Resolution", () => {
    beforeEach(() => {
      mockSupabase.auth.exchangeCodeForSession.mockResolvedValue({
        error: null,
      });
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: TEST_USER },
      });
    });

    it("should use organizationId from query parameter when provided", async () => {
      // Arrange
      const request = new NextRequest(
        "http://localhost:3000/auth/callback?code=test123&organizationId=query-org-id",
      );
      vi.mocked(getUserMembershipPublic).mockResolvedValue(TEST_MEMBERSHIP);

      // Act
      await GET(request);

      // Assert
      expect(getUserMembershipPublic).toHaveBeenCalledWith(
        TEST_USER.id,
        "query-org-id",
      );
      expect(updateUserOrganization).toHaveBeenCalledWith(
        TEST_USER.id,
        "query-org-id",
      );
    });

    it("should resolve organization from trusted subdomain header", async () => {
      // Arrange
      const request = new NextRequest(
        "http://localhost:3000/auth/callback?code=test123",
      );
      vi.mocked(extractTrustedSubdomain).mockReturnValue("trusted-subdomain");
      vi.mocked(getOrganizationBySubdomain).mockResolvedValue(TEST_ORG);
      vi.mocked(getUserMembershipPublic).mockResolvedValue(TEST_MEMBERSHIP);

      // Act
      await GET(request);

      // Assert
      expect(extractTrustedSubdomain).toHaveBeenCalled();
      expect(getOrganizationBySubdomain).toHaveBeenCalledWith(
        "trusted-subdomain",
      );
      expect(updateUserOrganization).toHaveBeenCalledWith(
        TEST_USER.id,
        TEST_ORG.id,
      );
    });

    it("should resolve organization from host alias fallback", async () => {
      // Arrange
      const request = new NextRequest(
        "http://localhost:3000/auth/callback?code=test123",
        {
          headers: { host: "testorg.pinpoint.app" },
        },
      );
      vi.mocked(extractTrustedSubdomain).mockReturnValue(null); // No trusted subdomain
      vi.mocked(resolveOrgSubdomainFromHost).mockReturnValue("testorg");
      vi.mocked(getOrganizationBySubdomain).mockResolvedValue(TEST_ORG);
      vi.mocked(getUserMembershipPublic).mockResolvedValue(TEST_MEMBERSHIP);

      // Act
      await GET(request);

      // Assert
      expect(resolveOrgSubdomainFromHost).toHaveBeenCalledWith(
        "testorg.pinpoint.app",
      );
      expect(getOrganizationBySubdomain).toHaveBeenCalledWith("testorg");
      expect(updateUserOrganization).toHaveBeenCalledWith(
        TEST_USER.id,
        TEST_ORG.id,
      );
    });

    it("should skip organization update when no organization resolved", async () => {
      // Arrange
      const request = new NextRequest(
        "http://localhost:3000/auth/callback?code=test123",
      );
      // All organization resolution methods return null

      // Act
      await GET(request);

      // Assert
      expect(getUserMembershipPublic).not.toHaveBeenCalled();
      expect(updateUserOrganization).not.toHaveBeenCalled();
    });
  });

  describe("Membership Validation", () => {
    beforeEach(() => {
      mockSupabase.auth.exchangeCodeForSession.mockResolvedValue({
        error: null,
      });
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: TEST_USER },
      });
      vi.mocked(getOrganizationBySubdomain).mockResolvedValue(TEST_ORG);
    });

    it("should validate user membership before updating organization", async () => {
      // Arrange
      const request = new NextRequest(
        "http://localhost:3000/auth/callback?code=test123&organizationId=" +
          TEST_ORG.id,
      );
      vi.mocked(getUserMembershipPublic).mockResolvedValue(TEST_MEMBERSHIP);

      // Act
      await GET(request);

      // Assert
      expect(getUserMembershipPublic).toHaveBeenCalledWith(
        TEST_USER.id,
        TEST_ORG.id,
      );
      expect(updateUserOrganization).toHaveBeenCalledWith(
        TEST_USER.id,
        TEST_ORG.id,
      );
    });

    it("should skip organization update when user has no membership", async () => {
      // Arrange
      const request = new NextRequest(
        "http://localhost:3000/auth/callback?code=test123&organizationId=" +
          TEST_ORG.id,
      );
      vi.mocked(getUserMembershipPublic).mockResolvedValue(null); // No membership

      // Act
      await GET(request);

      // Assert
      expect(getUserMembershipPublic).toHaveBeenCalledWith(
        TEST_USER.id,
        TEST_ORG.id,
      );
      expect(updateUserOrganization).not.toHaveBeenCalled();
    });

    it("should skip organization update when organizationId already matches", async () => {
      // Arrange
      const userWithCurrentOrg = {
        ...TEST_USER,
        app_metadata: { organizationId: TEST_ORG.id }, // Already has the org
      };
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: userWithCurrentOrg },
      });

      const request = new NextRequest(
        "http://localhost:3000/auth/callback?code=test123&organizationId=" +
          TEST_ORG.id,
      );
      vi.mocked(getUserMembershipPublic).mockResolvedValue(TEST_MEMBERSHIP);

      // Act
      await GET(request);

      // Assert
      expect(getUserMembershipPublic).toHaveBeenCalled();
      expect(updateUserOrganization).not.toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    beforeEach(() => {
      mockSupabase.auth.exchangeCodeForSession.mockResolvedValue({
        error: null,
      });
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: TEST_USER },
      });
    });

    it("should handle organization update failures gracefully", async () => {
      // Arrange
      const request = new NextRequest(
        "http://localhost:3000/auth/callback?code=test123&organizationId=" +
          TEST_ORG.id,
      );
      vi.mocked(getUserMembershipPublic).mockResolvedValue(TEST_MEMBERSHIP);
      vi.mocked(updateUserOrganization).mockRejectedValue(
        new Error("Database error"),
      );

      // Act
      const response = await GET(request);

      // Assert: Should still redirect successfully despite metadata update failure
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toContain("/dashboard");
    });

    it("should handle user resolution failures gracefully", async () => {
      // Arrange
      const request = new NextRequest(
        "http://localhost:3000/auth/callback?code=test123",
      );
      mockSupabase.auth.getUser.mockRejectedValue(
        new Error("Auth service error"),
      );

      // Act
      const response = await GET(request);

      // Assert: Should still redirect successfully
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toContain("/dashboard");
    });
  });

  describe("Redirect Behavior", () => {
    beforeEach(() => {
      mockSupabase.auth.exchangeCodeForSession.mockResolvedValue({
        error: null,
      });
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: TEST_USER },
      });
    });

    it("should redirect to custom next parameter", async () => {
      // Arrange
      const request = new NextRequest(
        "http://localhost:3000/auth/callback?code=test123&next=/custom-page",
      );

      // Act
      const response = await GET(request);

      // Assert
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toContain("/custom-page");
    });

    it("should redirect to dashboard by default", async () => {
      // Arrange
      const request = new NextRequest(
        "http://localhost:3000/auth/callback?code=test123",
      );

      // Act
      const response = await GET(request);

      // Assert
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toContain("/dashboard");
    });

    it("should use forwarded host for redirect in production", async () => {
      // Arrange: Mock production environment
      vi.doMock("~/env", () => ({
        env: { NODE_ENV: "production" },
      }));

      const request = new NextRequest(
        "http://localhost:3000/auth/callback?code=test123",
        {
          headers: { "x-forwarded-host": "app.pinpoint.com" },
        },
      );

      // Act
      const response = await GET(request);

      // Assert
      expect(response.headers.get("location")).toBe(
        "https://app.pinpoint.com/dashboard",
      );
    });
  });
});
