"use client";

import { Turnstile } from "@marsidev/react-turnstile";
import { type JSX, useCallback, useRef } from "react";

interface TurnstileWidgetProps {
  /** Called with the Turnstile token on successful verification */
  onVerify: (token: string) => void;
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
  className,
}: TurnstileWidgetProps): JSX.Element | null {
  const siteKey = process.env["NEXT_PUBLIC_TURNSTILE_SITE_KEY"];
  const widgetRef = useRef(null);

  const handleVerify = useCallback(
    (token: string) => {
      onVerify(token);
    },
    [onVerify]
  );

  if (!siteKey) {
    return null;
  }

  return (
    <Turnstile
      ref={widgetRef}
      siteKey={siteKey}
      onSuccess={handleVerify}
      options={{ size: "flexible" }}
      className={className}
    />
  );
}
