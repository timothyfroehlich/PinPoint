"use client";

import { Turnstile } from "@marsidev/react-turnstile";
import { type JSX, useCallback } from "react";

interface TurnstileWidgetProps {
  /** Called with the Turnstile token on successful verification */
  onVerify: (token: string) => void;
  /** Called when the token expires or verification fails, clearing the token */
  onExpire?: () => void;
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

  if (!siteKey) {
    return null;
  }

  return (
    <Turnstile
      siteKey={siteKey}
      onSuccess={handleVerify}
      onExpire={handleExpire}
      onError={handleExpire}
      options={{ size: "flexible" }}
      className={className}
    />
  );
}
