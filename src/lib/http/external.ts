import "server-only";
import { log } from "~/lib/logger";

/**
 * The shared HTTP path for calls to third-party APIs (PinballMap, Discord).
 *
 * It owns the behaviors every integration client needs alike: each request
 * carries a timeout, a network failure or timeout becomes a synthetic 599
 * response instead of a throw, and a 429 gets one bounded retry that honors
 * `Retry-After`. Integration-specific concerns
 * (headers, the PinballMap production guard, mapping statuses to results) stay
 * in the client that calls it.
 */

/** Status of the synthetic response `safeFetch` returns when `fetch` throws. */
export const NETWORK_ERROR_STATUS = 599;

/** Longest `Retry-After` we wait out inline before reporting rate-limited. */
const MAX_RETRY_AFTER_SECONDS = 5;

export interface ExternalFetchOptions {
  /**
   * Per-attempt budget, covering the response headers and the body read. A
   * request still running at the deadline is aborted: before headers it
   * surfaces as the 599, during the body read as a rejected body method.
   * Each client owns its values, chosen per endpoint class (PP-az4d.25); a
   * retry gets a fresh budget.
   */
  timeoutMs: number;
  /**
   * The warn line written when the request fails at the network layer; `err`
   * is added to `fields`. Never put a credentialed URL in `fields`. Omit it
   * only where the caller treats every failure as "no answer" and has never
   * logged one.
   */
  networkErrorLog?: { fields: Record<string, unknown>; message: string };
}

/**
 * `fetch` with a deadline that never throws for a network failure or a
 * timeout: it logs the failure and returns an empty 599 response, so callers
 * classify one `Response` shape.
 */
export async function safeFetch(
  url: string,
  init: RequestInit,
  options: ExternalFetchOptions
): Promise<Response> {
  const deadline = AbortSignal.timeout(options.timeoutMs);
  const signal = init.signal
    ? AbortSignal.any([init.signal, deadline])
    : deadline;
  try {
    return await fetch(url, { ...init, signal });
  } catch (err) {
    if (options.networkErrorLog) {
      log.warn(
        {
          err,
          ...options.networkErrorLog.fields,
          ...(deadline.aborted ? { timeoutMs: options.timeoutMs } : {}),
        },
        options.networkErrorLog.message
      );
    }
    return new Response(null, { status: NETWORK_ERROR_STATUS });
  }
}

export type RetryAfterResult =
  { rateLimited: false; response: Response } | { rateLimited: true };

/**
 * Send once; on a 429, wait out `Retry-After` and send exactly once more.
 *
 * Reports `rateLimited` when the second attempt is also a 429, or when
 * `Retry-After` exceeds the inline budget (then `onOverBudget` fires with the
 * requested seconds and no retry is sent). Any other response is returned
 * as-is, including the synthetic 599 from `safeFetch`.
 */
export async function withRetryAfter(
  send: () => Promise<Response>,
  onOverBudget: (retryAfterSeconds: number) => void
): Promise<RetryAfterResult> {
  let res = await send();
  if (res.status === 429) {
    const retryAfter = parseRetryAfter(res);
    if (retryAfter > MAX_RETRY_AFTER_SECONDS) {
      onOverBudget(retryAfter);
      return { rateLimited: true };
    }
    await sleep(retryAfter * 1000);
    res = await send();
    if (res.status === 429) return { rateLimited: true };
  }
  return { rateLimited: false, response: res };
}

function parseRetryAfter(res: Response): number {
  const header = res.headers.get("retry-after");
  if (header) {
    const n = Number.parseFloat(header);
    if (Number.isFinite(n)) return n;
  }
  return 1;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}
