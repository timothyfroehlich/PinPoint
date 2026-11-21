/**
 * Test Mocks
 *
 * Mock implementations for testing, especially Supabase auth and database operations.
 */

import { vi } from "vitest";
import type { Mock } from "vitest";
import type { User, AuthError, Session } from "@supabase/supabase-js";

// Explicit, portable shapes for the Supabase mock. Without these, the inferred
// return types reference vitest's private `Procedure` type, which the `composite`
// tsconfig.tests.json project flags as non-portable (TS2883) — visible as editor
// noise once test files are owned by that project. See PP-4k76.
interface MockSupabaseAuth {
  getUser: Mock;
  getSession: Mock;
  signInWithPassword: Mock;
  signUp: Mock;
  signOut: Mock;
  exchangeCodeForSession: Mock;
  resetPasswordForEmail: Mock;
  updateUser: Mock;
}
interface MockSupabaseClient {
  auth: MockSupabaseAuth;
  from: Mock;
}

/**
 * Mock Supabase user for testing
 */
export function createMockUser(overrides?: Partial<User>): User {
  return {
    id: overrides?.id ?? "test-user-id",
    email: overrides?.email ?? "test@example.com",
    aud: "authenticated",
    role: "authenticated",
    email_confirmed_at: new Date().toISOString(),
    phone: "",
    confirmed_at: new Date().toISOString(),
    last_sign_in_at: new Date().toISOString(),
    app_metadata: {},
    user_metadata: {},
    identities: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Mock Supabase session for testing
 */
export function createMockSession(user: User): Session {
  return {
    access_token: "mock-access-token",
    refresh_token: "mock-refresh-token",
    expires_in: 3600,
    expires_at: Date.now() / 1000 + 3600,
    token_type: "bearer",
    user,
  };
}

/**
 * Mock Supabase client with auth and database methods
 *
 * @param user - The authenticated user (null for unauthenticated)
 * @param options - Configuration for mock behavior
 */
export function createMockSupabaseClient(
  user: User | null = null,
  options: {
    authError?: AuthError;
    signInError?: AuthError;
    signUpError?: AuthError;
    signOutError?: AuthError;
  } = {}
): MockSupabaseClient {
  const session = user ? createMockSession(user) : null;

  return {
    auth: {
      // getUser() - Always use this in Server Components (revalidates token)
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: options.authError ?? null,
      }),

      // getSession() - Don't use in Server Components (doesn't revalidate)
      getSession: vi.fn().mockResolvedValue({
        data: { session },
        error: options.authError ?? null,
      }),

      // signInWithPassword() - Email/password authentication
      signInWithPassword: vi.fn().mockResolvedValue({
        data: {
          user: options.signInError ? null : user,
          session: options.signInError ? null : session,
        },
        error: options.signInError ?? null,
      }),

      // signUp() - New user registration
      signUp: vi.fn().mockResolvedValue({
        data: {
          user: options.signUpError ? null : user,
          session: options.signUpError ? null : session,
        },
        error: options.signUpError ?? null,
      }),

      // signOut() - Log out current user
      signOut: vi.fn().mockResolvedValue({
        error: options.signOutError ?? null,
      }),

      // exchangeCodeForSession() - OAuth callback
      exchangeCodeForSession: vi.fn().mockResolvedValue({
        data: {
          user: options.authError ? null : user,
          session: options.authError ? null : session,
        },
        error: options.authError ?? null,
      }),

      // resetPasswordForEmail() - Password reset
      resetPasswordForEmail: vi.fn().mockResolvedValue({
        data: {},
        error: null,
      }),

      // updateUser() - Update user metadata
      updateUser: vi.fn().mockResolvedValue({
        data: { user },
        error: null,
      }),
    },

    // Database query builder mock (for direct Supabase queries, not Drizzle)
    from: vi.fn((_table: string) => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      like: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      contains: vi.fn().mockReturnThis(),
      containedBy: vi.fn().mockReturnThis(),
      rangeGt: vi.fn().mockReturnThis(),
      rangeGte: vi.fn().mockReturnThis(),
      rangeLt: vi.fn().mockReturnThis(),
      rangeLte: vi.fn().mockReturnThis(),
      rangeAdjacent: vi.fn().mockReturnThis(),
      overlaps: vi.fn().mockReturnThis(),
      textSearch: vi.fn().mockReturnThis(),
      match: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      filter: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      limit: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
    })),
  };
}

/**
 * Mock the createClient function from ~/lib/supabase/server
 *
 * Use this in tests to mock the Supabase client at the module level.
 *
 * @example
 * ```typescript
 * import { mockCreateClient } from "~/test/helpers/mocks";
 *
 * vi.mock("~/lib/supabase/server", () => ({
 *   createClient: mockCreateClient(),
 * }));
 * ```
 */
export function mockCreateClient(user: User | null = null): Mock {
  return vi.fn().mockResolvedValue(createMockSupabaseClient(user));
}
