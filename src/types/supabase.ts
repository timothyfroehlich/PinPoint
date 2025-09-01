/**
 * @fileoverview DEPRECATED: Supabase database types file.
 * 
 * **THIS FILE IS DEPRECATED**
 * Database types have been moved to `~/lib/types/database.ts` for centralization.
 * All Supabase types are now available via `~/lib/types`.
 * 
 * Migration:
 * ```typescript
 * // OLD: import type { Database } from "~/types/supabase";
 * // NEW: import type { Database } from "~/lib/types";
 * ```
 * 
 * @deprecated Use `~/lib/types` instead
 * @see ~/lib/types/database.ts - New location for database schema types
 * @see ~/lib/types/supabase.ts - All Supabase type re-exports
 */

// Re-export for backwards compatibility
export type * from "~/lib/types/database";

// Backwards compatibility for specific named exports
export type { Json, Database } from "~/lib/types/database";