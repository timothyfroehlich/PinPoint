/**
 * Supabase server-side authentication utilities
 *
 * This file provides server-side authentication functions for Supabase
 */

import type { PinPointSupabaseUser } from "~/lib/types";

import { logger } from "~/lib/logger";
import { createClient } from "~/lib/supabase/server";
import { isError, isErrorWithCode } from "~/lib/utils/type-guards";

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
      logger.error({
        msg: "Error getting Supabase user",
        component: "auth.supabase.getSupabaseUser",
        context: {
          operation: "get_user",
        },
        error: {
          message: isError(error) ? error.message : String(error),
          code: isErrorWithCode(error) ? error.code : undefined,
        },
      });
      return null;
    }

    return user as PinPointSupabaseUser | null;
  } catch (error) {
    logger.error({
      msg: "Failed to create Supabase client",
      component: "auth.supabase.getSupabaseUser",
      context: {
        operation: "create_client",
      },
      error: {
        message: isError(error) ? error.message : String(error),
      },
    });
    return null;
  }
}
