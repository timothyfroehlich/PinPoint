import { log } from "~/lib/logger";

interface TurnstileVerifyResponse {
  success: boolean;
  "error-codes"?: string[];
  challenge_ts?: string;
  hostname?: string;
}

/**
 * Verify a Cloudflare Turnstile token server-side.
 *
 * If TURNSTILE_SECRET_KEY is not configured, returns true to allow
 * graceful degradation in development / test environments.
 *
 * @param token - The cf-turnstile-response token from the client
 * @param ip    - Optional client IP for additional validation
 * @returns Whether the token is valid
 */
export async function verifyTurnstileToken(
  token: string,
  ip?: string
): Promise<boolean> {
  const secretKey = process.env["TURNSTILE_SECRET_KEY"];

  if (!secretKey) {
    log.warn(
      { action: "turnstile" },
      "TURNSTILE_SECRET_KEY not set — skipping CAPTCHA verification"
    );
    return true;
  }

  if (!token) {
    const hasSiteKey = Boolean(process.env["NEXT_PUBLIC_TURNSTILE_SITE_KEY"]);
    log.warn(
      { action: "turnstile", hasSiteKey },
      hasSiteKey
        ? "Empty Turnstile token — widget may not have loaded"
        : "Empty Turnstile token — NEXT_PUBLIC_TURNSTILE_SITE_KEY not set, widget did not render"
    );
    return false;
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
      return false;
    }

    const data = (await res.json()) as TurnstileVerifyResponse;

    if (!data.success) {
      log.warn(
        { action: "turnstile", errors: data["error-codes"] },
        "Turnstile verification failed"
      );
    }

    return data.success;
  } catch (error) {
    log.error(
      {
        action: "turnstile",
        error: error instanceof Error ? error.message : "Unknown",
      },
      "Turnstile verification request failed"
    );
    return false;
  }
}
