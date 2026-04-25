/**
 * Server-side error reporting. Captures to Sentry AND structured logs in one call.
 *
 * Most server-action catch blocks were silently swallowing errors via `log.error`
 * alone — Sentry's auto-capture only sees uncaught exceptions, so caught errors
 * stayed invisible to monitoring (PP-a5y). These helpers route every caught
 * error to both pipelines from a single canonical entry point.
 *
 * SERVER-ONLY: imports the pino logger which is not safe to bundle into client
 * components. Client-side catch blocks should call Sentry.captureException directly.
 */

import * as Sentry from "@sentry/nextjs";

import { log } from "~/lib/logger";
import { err, type Result } from "~/lib/result";

export interface ReportContext {
  /** Short identifier of the failing operation. Used as the log message. */
  action?: string;
  /**
   * Mark when the error was tolerated by design (post-commit notifications,
   * blob deletions, etc.). The error is still captured — this flag lets alert
   * rules treat best-effort failures differently from primary-path failures.
   */
  bestEffort?: boolean;
  /** Arbitrary structured context attached to both Sentry and the log entry. */
  [key: string]: unknown;
}

/**
 * Capture an error to Sentry and write a structured log entry.
 *
 * Call from any server-side catch block. Returns void — the caller is
 * responsible for any user-facing behavior (returning err Result, throwing,
 * tolerating, etc.).
 */
export function reportError(error: unknown, context: ReportContext = {}): void {
  Sentry.captureException(error, { contexts: { pinpoint: context } });
  log.error({ err: error, ...context }, context.action ?? "Caught error");
}

/**
 * Convenience for server actions: report the error AND return a Result err.
 *
 * Replaces the `log.error(...); return err("SERVER", "...")` pattern that
 * previously left Sentry blind to ~50 caught failures across the codebase.
 *
 * @example
 *   try {
 *     await db.insert(machines).values(...);
 *   } catch (error) {
 *     return serverActionError(error, "SERVER", "Failed to create machine.", {
 *       action: "createMachineAction",
 *     });
 *   }
 */
export function serverActionError<C extends string>(
  error: unknown,
  code: C,
  message: string,
  context: ReportContext = {}
): Result<never, C> {
  reportError(error, context);
  return err(code, message);
}
