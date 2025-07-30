import { describe, it, expect } from "vitest";
import {
  mapSupabaseSessionToPinPoint,
  extractOrganizationFromSession,
  extractOrganizationFromJWT,
  validateSessionExpiry,
  getSessionUser,
  handleSessionError,
} from "../session-mapper";
import { SupabaseError } from "../errors";
import type { PinPointSupabaseSession, SupabaseJWTPayload } from "../types";

describe("Session Mapping Utilities", () => {
  const mockSupabaseSession: PinPointSupabaseSession = {
    access_token: "access-token-123",
    refresh_token: "refresh-token-123",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: "Bearer",
    user: {
      id: "user-123",
      email: "test@example.com",
      app_metadata: {
        organization_id: "org-123",
        role: "admin",
      },
      user_metadata: {
        name: "Test User",
        avatar_url: "https://example.com/avatar.jpg",
      },
      aud: "authenticated",
      created_at: "2023-01-01T00:00:00Z",
    },
  };

  describe("mapSupabaseSessionToPinPoint", () => {
    it("should successfully convert valid Supabase session", () => {
      const result = mapSupabaseSessionToPinPoint(mockSupabaseSession);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.session).toEqual({
          user: {
            id: "user-123",
            email: "test@example.com",
            name: "Test User",
            image: "https://example.com/avatar.jpg",
          },
          organizationId: "org-123",
          role: "admin",
          expires: new Date(
            (mockSupabaseSession.expires_at ?? 0) * 1000,
          ).toISOString(),
        });
      }
    });

    it("should handle session without user metadata", () => {
      const sessionWithoutMetadata: PinPointSupabaseSession = {
        ...mockSupabaseSession,
        user: {
          ...mockSupabaseSession.user,
          user_metadata: {},
        },
      };

      const result = mapSupabaseSessionToPinPoint(sessionWithoutMetadata);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.session.user).toEqual({
          id: "user-123",
          email: "test@example.com",
        });
      }
    });

    it("should handle session with null email", () => {
      const sessionWithNullEmail = {
        ...mockSupabaseSession,
        user: {
          ...mockSupabaseSession.user,
          email: null,
        },
      } as unknown as PinPointSupabaseSession;

      const result = mapSupabaseSessionToPinPoint(sessionWithNullEmail);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.session.user.email).toBe("");
      }
    });

    it("should fail when organization context is missing", () => {
      const sessionWithoutOrg: PinPointSupabaseSession = {
        ...mockSupabaseSession,
        user: {
          ...mockSupabaseSession.user,
          app_metadata: {},
        },
      };

      const result = mapSupabaseSessionToPinPoint(sessionWithoutOrg);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("organization_id");
        expect(result.session).toBeNull();
      }
    });

    it("should handle conversion errors gracefully", () => {
      const invalidSession = {
        ...mockSupabaseSession,
        expires_at: null,
      } as unknown as PinPointSupabaseSession;

      const result = mapSupabaseSessionToPinPoint(invalidSession);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Session mapping failed");
        expect(result.session).toBeNull();
      }
    });
  });

  describe("extractOrganizationFromSession", () => {
    it("should extract valid organization context", () => {
      const result = extractOrganizationFromSession(mockSupabaseSession);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({
          organizationId: "org-123",
          role: "admin",
        });
      }
    });

    it("should fail when organization_id is missing", () => {
      const sessionWithoutOrgId: PinPointSupabaseSession = {
        ...mockSupabaseSession,
        user: {
          ...mockSupabaseSession.user,
          app_metadata: {
            role: "admin",
          },
        },
      };

      const result = extractOrganizationFromSession(sessionWithoutOrgId);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("organization_id");
      }
    });

    it("should fail when role is missing", () => {
      const sessionWithoutRole: PinPointSupabaseSession = {
        ...mockSupabaseSession,
        user: {
          ...mockSupabaseSession.user,
          app_metadata: {
            organization_id: "org-123",
          },
        },
      };

      const result = extractOrganizationFromSession(sessionWithoutRole);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("role");
      }
    });

    it("should fail when organization_id is not a string", () => {
      const sessionWithInvalidOrgId: PinPointSupabaseSession = {
        ...mockSupabaseSession,
        user: {
          ...mockSupabaseSession.user,
          app_metadata: {
            organization_id: 123,
            role: "admin",
          } as unknown as { organization_id?: string; role?: string } & Record<
            string,
            unknown
          >,
        },
      };

      const result = extractOrganizationFromSession(sessionWithInvalidOrgId);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("organization_id");
      }
    });
  });

  describe("extractOrganizationFromJWT", () => {
    const mockJWTPayload: SupabaseJWTPayload = {
      aud: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
      iss: "https://example.supabase.co/auth/v1",
      sub: "user-123",
      email: "test@example.com",
      app_metadata: {
        organization_id: "org-123",
        role: "admin",
      },
      user_metadata: {},
    };

    it("should extract valid organization context from JWT", () => {
      const result = extractOrganizationFromJWT(mockJWTPayload);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({
          organizationId: "org-123",
          role: "admin",
        });
      }
    });

    it("should fail when JWT organization_id is missing", () => {
      const jwtWithoutOrgId: SupabaseJWTPayload = {
        ...mockJWTPayload,
        app_metadata: {
          role: "admin",
        },
      };

      const result = extractOrganizationFromJWT(jwtWithoutOrgId);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("JWT app_metadata");
      }
    });
  });

  describe("validateSessionExpiry", () => {
    it("should validate non-expired session", () => {
      const result = validateSessionExpiry(mockSupabaseSession);

      expect(result.valid).toBe(true);
    });

    it("should reject session without expires_at", () => {
      const sessionWithoutExpiry = {
        ...mockSupabaseSession,
        expires_at: undefined,
      } as unknown as PinPointSupabaseSession;

      const result = validateSessionExpiry(sessionWithoutExpiry);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe("INVALID_SESSION");
        expect(result.message).toContain("expiration timestamp");
      }
    });

    it("should reject expired session", () => {
      const expiredSession: PinPointSupabaseSession = {
        ...mockSupabaseSession,
        expires_at: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      };

      const result = validateSessionExpiry(expiredSession);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe("EXPIRED_TOKEN");
        expect(result.message).toContain("expired");
      }
    });

    it("should reject session without user ID", () => {
      const sessionWithoutUserId: PinPointSupabaseSession = {
        ...mockSupabaseSession,
        user: {
          ...mockSupabaseSession.user,
          id: "",
        },
      };

      const result = validateSessionExpiry(sessionWithoutUserId);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe("INVALID_SESSION");
        expect(result.message).toContain("user ID");
      }
    });
  });

  describe("getSessionUser", () => {
    it("should extract complete user information", () => {
      const user = getSessionUser(mockSupabaseSession);

      expect(user).toEqual({
        id: "user-123",
        email: "test@example.com",
        name: "Test User",
        image: "https://example.com/avatar.jpg",
      });
    });

    it("should handle missing user metadata", () => {
      const sessionWithoutMetadata: PinPointSupabaseSession = {
        ...mockSupabaseSession,
        user: {
          ...mockSupabaseSession.user,
          user_metadata: {},
        },
      };

      const user = getSessionUser(sessionWithoutMetadata);

      expect(user).toEqual({
        id: "user-123",
        email: "test@example.com",
      });
    });

    it("should handle null email", () => {
      const sessionWithNullEmail = {
        ...mockSupabaseSession,
        user: {
          ...mockSupabaseSession.user,
          email: null,
        },
      } as unknown as PinPointSupabaseSession;

      const user = getSessionUser(sessionWithNullEmail);

      expect(user.email).toBe("");
    });
  });

  describe("handleSessionError", () => {
    it("should handle SupabaseError correctly", () => {
      const supabaseError = new SupabaseError("EXPIRED_TOKEN", "Token expired");
      const result = handleSessionError(supabaseError);

      expect(result).toEqual({
        error: "EXPIRED_TOKEN",
        message: "Token expired",
      });
    });

    it("should categorize expired token errors", () => {
      const expiredError = new Error("JWT token has expired");
      const result = handleSessionError(expiredError, "authentication");

      expect(result).toEqual({
        error: "EXPIRED_TOKEN",
        message: "Token expired during authentication",
      });
    });

    it("should categorize organization errors", () => {
      const orgError = new Error("Missing organization context");
      const result = handleSessionError(orgError, "session mapping");

      expect(result).toEqual({
        error: "MISSING_ORGANIZATION",
        message: "Organization context missing in session mapping",
      });
    });

    it("should categorize JWT errors", () => {
      const jwtError = new Error("Invalid JWT signature");
      const result = handleSessionError(jwtError);

      expect(result).toEqual({
        error: "INVALID_JWT",
        message: "Invalid JWT",
      });
    });

    it("should handle generic errors", () => {
      const genericError = new Error("Something went wrong");
      const result = handleSessionError(genericError, "validation");

      expect(result).toEqual({
        error: "INVALID_SESSION",
        message: "Session error in validation: Something went wrong",
      });
    });

    it("should handle unknown errors", () => {
      const result = handleSessionError("string error", "processing");

      expect(result).toEqual({
        error: "CONFIGURATION_ERROR",
        message: "Unknown error in processing: string error",
      });
    });

    it("should handle errors without context", () => {
      const error = new Error("Generic error");
      const result = handleSessionError(error);

      expect(result).toEqual({
        error: "INVALID_SESSION",
        message: "Session error: Generic error",
      });
    });
  });
});
