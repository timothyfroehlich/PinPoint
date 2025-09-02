/**
 * @fileoverview DEPRECATED: Custom Supabase Client Type Definitions
 *
 * **THIS FILE IS DEPRECATED**
 * Supabase client types have been moved to `~/lib/types/auth.ts` for centralization.
 * All Supabase types are now available via `~/lib/types`.
 *
 * Migration:
 * ```typescript
 * // OLD: import type { TypedSupabaseClient } from "~/types/supabase-client";
 * // NEW: import type { TypedSupabaseClient } from "~/lib/types";
 * ```
 *
 * @deprecated Use `~/lib/types` instead
 * @see ~/lib/types/auth.ts - New location for Supabase client types
 * @see ~/lib/types/database.ts - Database schema types
 */

import type { Database } from "~/lib/types";

// Re-export the auto-generated Database type
export type { Database };

// TypedSupabaseClient has been moved to ~/lib/types/auth.ts
// Please import from "~/lib/types" instead of this deprecated file
