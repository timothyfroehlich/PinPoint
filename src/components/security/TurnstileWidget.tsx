"use client";

import { Turnstile } from "@marsidev/react-turnstile";
import { type JSX, useCallback } from "react";

interface TurnstileWidgetProps {
  /** Called with the Turnstile token on successful verification */
  onVerify: (token: string) => void;
  /** Called when the token expires (widget auto-refreshes a new one) */
  onExpire?: () => void;
  /**
   * Called when verification errors. Distinct from `onExpire`: an error is NOT
   * a reason to clear a previously-good token — the widget auto-retries
   * (`retry: "auto"`). Wiring this to a token-clearing handler is what caused
   * the permanent lockout in PP-20yy, so keep it separate.
   */
  onError?: () => void;
  /** Optional CSS class name */
  className?: string;
}

/**
 * Cloudflare Turnstile CAPTCHA widget (managed mode).
 *
 * Renders nothing when NEXT_PUBLIC_TURNSTILE_SITE_KEY is not set,
 * allowing graceful degradation in development and test environments.
 */
export function TurnstileWidget({
  onVerify,
  onExpire,
  onError,
  className,
}: TurnstileWidgetProps): JSX.Element | null {
  const siteKey = process.env["NEXT_PUBLIC_TURNSTILE_SITE_KEY"];

  const handleVerify = useCallback(
    (token: string) => {
      onVerify(token);
    },
    [onVerify]
  );

  const handleExpire = useCallback(() => {
    onExpire?.();
  }, [onExpire]);

  const handleError = useCallback(() => {
    onError?.();
  }, [onError]);

  if (!siteKey) {
    return null;
  }

  return (
    <Turnstile
      siteKey={siteKey}
      onSuccess={handleVerify}
      onExpire={handleExpire}
      onError={handleError}
      options={{
        size: "flexible",
        appearance: "interaction-only",
        refreshExpired: "auto",
        // Auto-retry on transient widget/network failure instead of stranding
        // the user on a single failed attempt (PP-20yy resilience).
        retry: "auto",
      }}
      className={className}
    />
  );
}
