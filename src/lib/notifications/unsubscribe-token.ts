import "server-only";
import { Buffer } from "node:buffer";
import { createHmac, timingSafeEqual } from "node:crypto";
import { log } from "~/lib/logger";

let warnedMissingSecret = false;

/**
 * Returns the HMAC signing secret for unsubscribe tokens.
 * Uses UNSUBSCRIBE_SIGNING_SECRET, which must be set independently of the
 * Supabase service role key so that Supabase key rotation does not invalidate
 * outstanding unsubscribe URLs.
 *
 * Logs once in production if the secret is missing — without it, unsubscribe
 * links are omitted from outgoing emails and any incoming /api/unsubscribe
 * request will reject, which is a CAN-SPAM compliance risk worth surfacing.
 */
function getUnsubscribeSigningSecret(): string {
  const secret = process.env["UNSUBSCRIBE_SIGNING_SECRET"] ?? "";
  if (!secret && !warnedMissingSecret) {
    warnedMissingSecret = true;
    if (process.env["VERCEL_ENV"] === "production") {
      log.error(
        { action: "unsubscribe.signingSecretMissing" },
        "UNSUBSCRIBE_SIGNING_SECRET not set in production — unsubscribe links " +
          "will be omitted from outgoing emails and incoming requests will reject."
      );
    }
  }
  return secret;
}

/**
 * Generate an HMAC-signed unsubscribe token for a user.
 * Uses UNSUBSCRIBE_SIGNING_SECRET as the signing secret.
 */
export function generateUnsubscribeToken(userId: string): string {
  const secret = getUnsubscribeSigningSecret();
  if (!secret) {
    return "";
  }
  return createHmac("sha256", secret)
    .update(userId + ":unsubscribe")
    .digest("hex");
}

/**
 * Verify an unsubscribe token against a userId.
 */
export function verifyUnsubscribeToken(userId: string, token: string): boolean {
  const expected = generateUnsubscribeToken(userId);
  if (!expected || token.length === 0) return false;
  const expectedBuf = Buffer.from(expected, "utf-8");
  const tokenBuf = Buffer.from(token, "utf-8");
  if (expectedBuf.length !== tokenBuf.length) return false;
  return timingSafeEqual(expectedBuf, tokenBuf);
}
