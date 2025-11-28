/**
 * Result type for type-safe error handling in Server Actions
 *
 * Use this pattern for operations that can fail in multiple ways,
 * especially security-critical operations like authentication.
 *
 * @example
 * ```ts
 * type LoginResult = Result<{ userId: string }, "AUTH" | "VALIDATION">;
 *
 * async function login(): Promise<LoginResult> {
 *   if (!valid) return err("VALIDATION", "Invalid input");
 *   if (!authenticated) return err("AUTH", "Wrong password");
 *   return ok({ userId: "123" });
 * }
 * ```
 */
export type Result<T, C extends string = string, M = undefined> =
  | { ok: true; value: T }
  | { ok: false; code: C; message: string; meta?: M };

/**
 * Create a successful Result
 */
export const ok = <T>(value: T): Result<T, never> => ({
  ok: true as const,
  value,
});

/**
 * Create a failed Result with error code and message
 */
export const err = <C extends string, M = undefined>(
  code: C,
  message: string,
  meta?: M
): Result<never, C, M> => {
  if (meta !== undefined) {
    return {
      ok: false as const,
      code,
      message,
      meta,
    };
  }
  return {
    ok: false as const,
    code,
    message,
  };
};
