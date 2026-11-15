/**
 * Shared replacement for `~/lib/supabase/server` in integration tests.
 *
 * Wire it with one line, then drive the signed-in user per test:
 *
 * ```typescript
 * vi.mock("~/lib/supabase/server", () => import("~/test/helpers/mock-auth"));
 * import { signInAs, signOut } from "~/test/helpers/mock-auth";
 *
 * beforeEach(() => signInAs(userId));
 * ```
 *
 * The factory imports this module, so the test file and the code under test
 * share one instance: `signInAs` changes what `createClient().auth.getUser()`
 * resolves to. The default (before any `signInAs`, and after `vi.resetAllMocks`)
 * is signed out. Only `auth.getUser` is modelled; a test whose code under test
 * calls other Supabase client methods keeps its own mock.
 */

import { vi } from "vitest";

interface MockAuthUser {
  id: string;
  email?: string;
}

interface GetUserResult {
  data: { user: MockAuthUser | null };
  error: null;
}

function result(user: MockAuthUser | null): GetUserResult {
  return { data: { user }, error: null };
}

/**
 * The `auth.getUser` mock behind `createClient`. Exposed for tests that assert
 * on calls or need a one-off response (`mockGetUser.mockResolvedValueOnce`).
 */
export const mockGetUser = vi.fn((): Promise<GetUserResult> =>
  Promise.resolve(result(null))
);

/** Sign in as `user` (a profile id, or an id plus email) for subsequent calls. */
export function signInAs(user: string | MockAuthUser): void {
  mockGetUser.mockResolvedValue(
    result(typeof user === "string" ? { id: user } : user)
  );
}

/** Make `auth.getUser` resolve to no user. */
export function signOut(): void {
  mockGetUser.mockResolvedValue(result(null));
}

/** Stand-in for `createClient` from `~/lib/supabase/server`. */
export function createClient(): Promise<{
  auth: { getUser: typeof mockGetUser };
}> {
  return Promise.resolve({ auth: { getUser: mockGetUser } });
}
