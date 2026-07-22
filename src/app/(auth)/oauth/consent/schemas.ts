import { z } from "zod";

/**
 * Validation schema for the Supabase OAuth `authorization_id`.
 *
 * Separated from `actions.ts` because `"use server"` files can only export
 * async functions, not objects. The id is an opaque Supabase-issued handle, so
 * we only assert it is a non-empty, sanely-bounded string rather than pinning a
 * format that could drift.
 */
export const authorizationIdSchema = z
  .string()
  .trim()
  .min(1, "Missing authorization request.")
  .max(255, "Malformed authorization request.");
