import { isRedirectError } from "next/dist/client/components/redirect-error";

/**
 * Rethrow a Next.js `redirect()` signal so it reaches the framework instead of
 * being reported as a failure. Call it first in a Server Action's `catch`.
 */
export function rethrowIfRedirect(error: unknown): void {
  if (isRedirectError(error)) {
    throw error;
  }
}
