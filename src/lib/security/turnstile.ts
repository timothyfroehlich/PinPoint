import "server-only";

import * as Sentry from "@sentry/nextjs";

import { log } from "~/lib/logger";

interface TurnstileVerifyResponse {
  success: boolean;
  "error-codes"?: string[];
  challenge_ts?: string;
  hostname?: string;
}

/**
 * Discriminated outcome of a server-side Turnstile verification attempt.
 *
 * Kept internal so the two public entry points can render it into their own
 * shapes: {@link verifyTurnstileToken} collapses it to a strict boolean, while
 * {@link verifyTurnstileFailOpen} keeps every submission flowing and only uses
 * the outcome for observability.
 */
type TurnstileOutcome =
  /** No secret configured in dev/test, or the Cloudflare test secret — skip. */
  | { kind: "skipped" }
  /** Token present and Cloudflare confirmed it. */
  | { kind: "verified" }
  /** Client sent no token (widget never produced one). */
  | { kind: "missing-token" }
  /** Cloudflare actively rejected the token. */
  | { kind: "invalid-token"; errorCodes: string[] | undefined }
  /** Could not reach a verdict (HTTP error, network error, missing prod key). */
  | { kind: "unverifiable"; reason: string };

/**
 * Cloudflare's well-known "always passes" test secret key.
 * When this key is configured, skip server-side verification entirely
 * because the widget JS may not complete in headless test browsers
 * (Playwright, etc.), leaving the token empty.
 *
 * @see https://developers.cloudflare.com/turnstile/troubleshooting/testing/
 */
const TURNSTILE_TEST_SECRET = "1x0000000000000000000000000000000AA";

/**
 * Core verification against Cloudflare's siteverify endpoint. Returns a
 * discriminated outcome without deciding whether the caller should be allowed
 * through — that policy lives in the public wrappers below.
 */
async function runTurnstileVerification(
  token: string,
  ip?: string
): Promise<TurnstileOutcome> {
  const secretKey = process.env["TURNSTILE_SECRET_KEY"];

  if (!secretKey) {
    if (process.env.NODE_ENV === "production") {
      log.error(
        { action: "turnstile" },
        "TURNSTILE_SECRET_KEY not set in production — CAPTCHA verification cannot run"
      );
      return { kind: "unverifiable", reason: "no-secret-key-prod" };
    }
    log.warn(
      { action: "turnstile" },
      "TURNSTILE_SECRET_KEY not set — skipping CAPTCHA verification"
    );
    return { kind: "skipped" };
  }

  // Cloudflare test keys: skip verification entirely. The widget JS may
  // not complete in headless browsers (Playwright), producing no token.
  if (secretKey === TURNSTILE_TEST_SECRET) {
    return { kind: "skipped" };
  }

  if (!token) {
    const hasSiteKey = Boolean(process.env["NEXT_PUBLIC_TURNSTILE_SITE_KEY"]);
    log.warn(
      { action: "turnstile", hasSiteKey },
      hasSiteKey
        ? "Empty Turnstile token — widget may not have loaded"
        : "Empty Turnstile token — NEXT_PUBLIC_TURNSTILE_SITE_KEY not set, widget did not render"
    );
    return { kind: "missing-token" };
  }

  try {
    const body: Record<string, string> = {
      secret: secretKey,
      response: token,
    };

    if (ip) {
      body["remoteip"] = ip;
    }

    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(body).toString(),
      }
    );

    if (!res.ok) {
      log.error(
        { action: "turnstile", status: res.status },
        "Turnstile siteverify HTTP error"
      );
      return { kind: "unverifiable", reason: `http-${String(res.status)}` };
    }

    const data = (await res.json()) as TurnstileVerifyResponse;

    if (!data.success) {
      log.warn(
        { action: "turnstile", errors: data["error-codes"] },
        "Turnstile verification failed"
      );
      return { kind: "invalid-token", errorCodes: data["error-codes"] };
    }

    return { kind: "verified" };
  } catch (error) {
    log.error(
      {
        action: "turnstile",
        err: error instanceof Error ? error.message : "Unknown",
      },
      "Turnstile verification request failed"
    );
    return { kind: "unverifiable", reason: "fetch-error" };
  }
}

/**
 * Verify a Cloudflare Turnstile token server-side (STRICT / fail-closed).
 *
 * If TURNSTILE_SECRET_KEY is not configured, returns true to allow
 * graceful degradation in development / test environments.
 *
 * Used by surfaces where a hard captcha gate is still desired (e.g. anonymous
 * public issue reports). Auth forms use {@link verifyTurnstileFailOpen} instead
 * — see that function's doc comment for the availability tradeoff.
 *
 * @param token - The cf-turnstile-response token from the client
 * @param ip    - Optional client IP for additional validation
 * @returns Whether the token is valid
 */
export async function verifyTurnstileToken(
  token: string,
  ip?: string
): Promise<boolean> {
  const outcome = await runTurnstileVerification(token, ip);
  return outcome.kind === "verified" || outcome.kind === "skipped";
}

/** Reason a fail-open submission was allowed without a confirmed token. */
export type TurnstileFailOpenReason =
  "verified" | "skipped" | "missing-token" | "invalid-token" | "unverifiable";

export interface TurnstileFailOpenResult {
  /**
   * Always true. This gate NEVER blocks a submission — see the doc comment.
   * Exposed as a field (rather than a bare boolean) so callers read as
   * `.allowed` and future policy changes stay source-compatible.
   */
  allowed: true;
  /** Why the submission was allowed, for logging/branching by the caller. */
  reason: TurnstileFailOpenReason;
}

/**
 * Verify a Turnstile token but ALWAYS allow the submission through (FAIL OPEN).
 *
 * ── Intentional availability > strict-captcha tradeoff (PP-20yy) ────────────
 * Cloudflare Turnstile is an external dependency that fails transiently in the
 * real world (slow/blocked widget script, challenge timeout, network blip,
 * ad-blocker/extension interference). When it does, a fail-CLOSED gate leaves a
 * legitimate user unable to sign in / sign up / reset their password with no
 * way forward. That has locked real users out repeatedly, so Tim chose
 * (2026-07-10) to make the auth captcha gate resilient first and, as a last
 * resort, fail OPEN: never block the request on a missing/unverifiable token.
 *
 * The client mirrors this (see `useTurnstileGate`): it retries the widget and
 * only enables submission without a token after a bounded resilience window.
 * Rate limiting (IP + account) remains the real abuse backstop — captcha here
 * is best-effort deterrence, not a hard boundary. Do NOT "fix" this back to
 * fail-closed without reverting the client gate AND re-enabling Supabase's
 * built-in captcha protection; the two sides must stay consistent, and while
 * Supabase captcha is on it would reject the very tokenless submissions this
 * gate is meant to let through.
 *
 * Every fail-open path (token missing, rejected, or unverifiable) emits a
 * structured log line AND a Sentry message so abuse is monitorable.
 *
 * @param token   - The cf-turnstile-response token from the client (may be "")
 * @param ip      - Optional client IP for additional validation
 * @param action  - Short identifier of the calling flow (for observability)
 * @returns Always `{ allowed: true, reason }`.
 */
export async function verifyTurnstileFailOpen(
  token: string,
  ip: string | undefined,
  action: string
): Promise<TurnstileFailOpenResult> {
  const outcome = await runTurnstileVerification(token, ip);

  if (outcome.kind === "verified" || outcome.kind === "skipped") {
    return { allowed: true, reason: outcome.kind };
  }

  // Fail-open path: the token was missing, rejected, or unverifiable, but we
  // let the submission proceed anyway. Emit observability so this stays
  // monitorable (spikes here may indicate abuse OR a Turnstile outage).
  const detail =
    outcome.kind === "unverifiable"
      ? { reason: outcome.reason }
      : outcome.kind === "invalid-token"
        ? { errorCodes: outcome.errorCodes }
        : {};

  log.warn(
    { action, event: "turnstile_fail_open", outcome: outcome.kind, ...detail },
    "Turnstile fail-open: allowing submission without a verified token"
  );
  Sentry.captureMessage("turnstile.fail_open", {
    level: "warning",
    tags: { action, turnstileOutcome: outcome.kind },
    extra: detail,
  });

  return { allowed: true, reason: outcome.kind };
}
