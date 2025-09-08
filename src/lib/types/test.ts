/**
 * Test Types (Centralized)
 *
 * Shared test types and interfaces used across test files.
 * Moved here to comply with CORE-TS-001 type centralization.
 */

import type { MockProxy } from "vitest-mock-extended";
import type { TRPCContext } from "~/server/api/trpc.base";
import type { DrizzleClient } from "~/server/db/drizzle";
import type { SupabaseServerClient } from "~/lib/supabase/server";

/**
 * Anonymous user test context with organization scoping
 */
export interface AnonymousTestContext {
  /** Mocked tRPC context for anonymous user */
  mockContext: Partial<TRPCContext>;
  /** Mocked Drizzle database client */
  mockDb: MockProxy<DrizzleClient>;
  /** Mocked Supabase client */
  mockSupabase: MockProxy<SupabaseServerClient>;
  /** Current organization context */
  organization: {
    id: string;
    name: string;
    subdomain: string;
  };
  /** Request headers with subdomain */
  headers: Headers;
}
