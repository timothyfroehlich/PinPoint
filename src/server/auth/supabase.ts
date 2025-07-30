/**
 * Supabase server-side authentication utilities
 *
 * This file provides server-side authentication functions for Supabase
 */

import { createClient } from "../../../lib/supabase/server";

import type { PinPointSupabaseUser } from "../../../lib/supabase/types";

/**
 * Get the current authenticated user on the server
 * Returns null if no user is authenticated
 */
export async function getSupabaseUser(): Promise<PinPointSupabaseUser | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      console.error("Error getting Supabase user:", error);
      return null;
    }

    return user as PinPointSupabaseUser | null;
  } catch (error) {
    console.error("Failed to create Supabase client:", error);
    return null;
  }
}
