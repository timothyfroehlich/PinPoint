/**
 * Test Mocks
 *
 * Mock implementations for testing, especially Supabase auth.
 */

import { vi } from "vitest";
import type { User } from "@supabase/supabase-js";

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
 * Mock Supabase client with auth methods
 */
export function createMockSupabaseClient(user: User | null = null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: null,
      }),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      signUp: vi.fn(),
    },
  };
}

/**
 * Set the mock user for Supabase auth calls.
 * Use this in tests to simulate authenticated/unauthenticated states.
 *
 * @example
 * // Simulate authenticated user
 * mockSupabaseAuth(createMockUser({ id: "user-123" }));
 *
 * // Simulate unauthenticated user
 * mockSupabaseAuth(null);
 */
export function mockSupabaseAuth(user: User | null) {
  // This is a placeholder - in real tests, you'd mock the actual
  // Supabase client creation. For now, tests can use this pattern
  // to document auth requirements.
  return createMockSupabaseClient(user);
}
