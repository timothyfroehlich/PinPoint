import { describe, it, expect } from "vitest";
import {
  isPinPointSupabaseUser,
  isPinPointSupabaseSession,
  isValidOrganizationContext,
  isAuthenticationState,
  type PinPointSupabaseUser,
  type PinPointSupabaseSession,
  type OrganizationContext,
  type AuthenticationState,
  type PinPointSession,
} from "../types";

describe("Type Guards", () => {
  describe("isPinPointSupabaseUser", () => {
    it("should return true for valid PinPoint Supabase user", () => {
      const user = {
        id: "test-user-id",
        email: "test@example.com",
        app_metadata: {
          organization_id: "org-123",
          role: "admin",
        },
        user_metadata: {},
        aud: "authenticated",
        created_at: "2023-01-01T00:00:00Z",
      } as PinPointSupabaseUser;

      expect(isPinPointSupabaseUser(user)).toBe(true);
    });

    it("should return true for user with empty app_metadata", () => {
      const user = {
        id: "test-user-id",
        email: "test@example.com",
        app_metadata: {},
        user_metadata: {},
        aud: "authenticated",
        created_at: "2023-01-01T00:00:00Z",
      } as PinPointSupabaseUser;

      expect(isPinPointSupabaseUser(user)).toBe(true);
    });

    it("should return false for user with null app_metadata", () => {
      const user = {
        id: "test-user-id",
        email: "test@example.com",
        app_metadata: null,
        user_metadata: {},
        aud: "authenticated",
        created_at: "2023-01-01T00:00:00Z",
      } as unknown as PinPointSupabaseUser;

      expect(isPinPointSupabaseUser(user)).toBe(false);
    });
  });

  describe("isPinPointSupabaseSession", () => {
    it("should return true for valid PinPoint Supabase session", () => {
      const session = {
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: "Bearer",
        user: {
          id: "test-user-id",
          email: "test@example.com",
          app_metadata: {
            organization_id: "org-123",
            role: "admin",
          },
          user_metadata: {},
          aud: "authenticated",
          created_at: "2023-01-01T00:00:00Z",
        },
      } as PinPointSupabaseSession;

      expect(isPinPointSupabaseSession(session)).toBe(true);
    });

    it("should return false for session with invalid user", () => {
      const session = {
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: "Bearer",
        user: {
          id: "test-user-id",
          email: "test@example.com",
          app_metadata: null,
          user_metadata: {},
          aud: "authenticated",
          created_at: "2023-01-01T00:00:00Z",
        },
      } as unknown as PinPointSupabaseSession;

      expect(isPinPointSupabaseSession(session)).toBe(false);
    });
  });

  describe("isValidOrganizationContext", () => {
    it("should return true for valid organization context", () => {
      const context: OrganizationContext = {
        organizationId: "org-123",
        role: "admin",
      };

      expect(isValidOrganizationContext(context)).toBe(true);
    });

    it("should return false for null context", () => {
      expect(isValidOrganizationContext(null)).toBe(false);
    });

    it("should return false for undefined context", () => {
      expect(isValidOrganizationContext(undefined)).toBe(false);
    });

    it("should return false for missing organizationId", () => {
      const context = {
        role: "admin",
      };

      expect(isValidOrganizationContext(context)).toBe(false);
    });

    it("should return false for missing role", () => {
      const context = {
        organizationId: "org-123",
      };

      expect(isValidOrganizationContext(context)).toBe(false);
    });

    it("should return false for non-string organizationId", () => {
      const context = {
        organizationId: 123,
        role: "admin",
      };

      expect(isValidOrganizationContext(context)).toBe(false);
    });

    it("should return false for non-string role", () => {
      const context = {
        organizationId: "org-123",
        role: 123,
      };

      expect(isValidOrganizationContext(context)).toBe(false);
    });
  });

  describe("isAuthenticationState", () => {
    it("should return true for authenticated state", () => {
      const session: PinPointSession = {
        user: {
          id: "user-123",
          email: "test@example.com",
          name: "Test User",
        },
        organizationId: "org-123",
        role: "admin",
        expires: new Date(Date.now() + 3600000).toISOString(),
      };

      const state: AuthenticationState = {
        type: "authenticated",
        session,
      };

      expect(isAuthenticationState(state)).toBe(true);
    });

    it("should return true for anonymous state", () => {
      const state: AuthenticationState = {
        type: "anonymous",
        session: null,
      };

      expect(isAuthenticationState(state)).toBe(true);
    });

    it("should return true for expired state", () => {
      const state: AuthenticationState = {
        type: "expired",
        session: null,
      };

      expect(isAuthenticationState(state)).toBe(true);
    });

    it("should return true for loading state", () => {
      const state: AuthenticationState = {
        type: "loading",
        session: null,
      };

      expect(isAuthenticationState(state)).toBe(true);
    });

    it("should return false for null state", () => {
      expect(isAuthenticationState(null)).toBe(false);
    });

    it("should return false for undefined state", () => {
      expect(isAuthenticationState(undefined)).toBe(false);
    });

    it("should return false for state without type", () => {
      const state = {
        session: null,
      };

      expect(isAuthenticationState(state)).toBe(false);
    });

    it("should return false for invalid type", () => {
      const state = {
        type: "invalid",
        session: null,
      };

      expect(isAuthenticationState(state)).toBe(false);
    });

    it("should return false for authenticated state with null session", () => {
      const state = {
        type: "authenticated",
        session: null,
      };

      expect(isAuthenticationState(state)).toBe(false);
    });
  });
});
