"use client";

import * as Sentry from "@sentry/nextjs";
import { useCallback, useEffect, useState } from "react";

/**
 * How long to wait for a Turnstile token before failing open and enabling
 * submission anyway. Long enough for a healthy widget to solve an
 * interaction-only challenge (typically < 1s) plus retries on a transient
 * blip, short enough that a genuinely-stuck widget doesn't strand the user.
 */
const FAIL_OPEN_TIMEOUT_MS = 8000;

export interface TurnstileGate {
  /** Current token; wire into a hidden `captchaToken` input. May be "". */
  token: string;
  /**
   * Whether the submit button should be disabled *for captcha reasons*.
   * Callers OR this with their own `isPending`. Only ever true during the
   * initial resilience window — once a token arrives OR the window elapses
   * (fail-open latch), this is false forever, so the button never dies.
   */
  submitDisabled: boolean;
  /** Optional user-facing status while waiting; null when nothing to show. */
  statusMessage: string | null;
  /** Pass to `TurnstileWidget.onVerify`. */
  onVerify: (token: string) => void;
  /** Pass to `TurnstileWidget.onError`. Does NOT clear the token (resilience). */
  onError: () => void;
  /** Pass to `TurnstileWidget.onExpire`. */
  onExpire: () => void;
}

/**
 * Shared Turnstile gating logic for the auth forms (login, signup,
 * forgot-password, reset-password).
 *
 * ── Resilience first, then fail open (PP-20yy) ──────────────────────────────
 * The previous per-form implementation hard-disabled submit until a token
 * existed AND wired the widget's `onError` to a handler that *cleared* the
 * token — so any transient Turnstile failure left the button permanently dead
 * with no feedback. Tim chose (2026-07-10) availability over strict captcha
 * enforcement here after repeated real-user lockouts.
 *
 * This hook:
 *  1. Never clears the token on error (`onError` is a no-op for token state);
 *     the widget auto-retries (`retry: "auto"`, `refreshExpired: "auto"`).
 *  2. Runs a bounded resilience window: transient blips that recover within
 *     {@link FAIL_OPEN_TIMEOUT_MS} enable submit *with* a real token.
 *  3. Fails open as a last resort: once the window elapses with no token, a
 *     one-way latch enables submit anyway and emits a Sentry breadcrumb.
 *
 * The server mirrors this via `verifyTurnstileFailOpen` — both sides must stay
 * consistent (see that function's doc comment).
 */
export function useTurnstileGate(): TurnstileGate {
  const hasTurnstile = Boolean(process.env["NEXT_PUBLIC_TURNSTILE_SITE_KEY"]);
  const enforceCaptcha = hasTurnstile && process.env.NODE_ENV !== "test";

  const [token, setToken] = useState("");
  const [failedOpen, setFailedOpen] = useState(false);

  // Fail-open latch: after a bounded window with no token, enable submit anyway.
  // The latch is one-way — once open it never re-disables, so a later expiry or
  // error can't resurrect the dead-button bug.
  useEffect(() => {
    if (!enforceCaptcha || token || failedOpen) {
      return;
    }
    const timer = setTimeout(() => {
      setFailedOpen(true);
      Sentry.addBreadcrumb({
        category: "turnstile",
        level: "warning",
        message: "turnstile.client_fail_open",
        data: { timeoutMs: FAIL_OPEN_TIMEOUT_MS },
      });
    }, FAIL_OPEN_TIMEOUT_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [enforceCaptcha, token, failedOpen]);

  const onVerify = useCallback((next: string) => {
    setToken(next);
  }, []);

  // Resilience: intentionally do NOT clear the token on error. The widget
  // auto-retries; clearing here is exactly what caused the permanent lockout.
  const onError = useCallback(() => {
    /* no-op: keep any existing token, let the widget retry */
  }, []);

  const onExpire = useCallback(() => {
    setToken("");
  }, []);

  const waiting = enforceCaptcha && !token && !failedOpen;

  return {
    token,
    submitDisabled: waiting,
    statusMessage: waiting ? "Verifying you're human…" : null,
    onVerify,
    onError,
    onExpire,
  };
}
