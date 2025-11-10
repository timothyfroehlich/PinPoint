/**
 * Supabase Validation Types
 * Types for comprehensive Supabase response validation
 */

import type { AuthError } from "@supabase/supabase-js";
import type { AuthErrorType } from "./auth";

/**
 * Comprehensive validation result for Supabase operations
 */
export interface SupabaseValidationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    type: AuthErrorType;
    message: string;
    originalError?: AuthError;
  };
}
