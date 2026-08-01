import "server-only";
import { Buffer } from "node:buffer";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { log } from "~/lib/logger";

/**
 * Shared CRON_SECRET bearer-auth gate for cron routes.
 *
 * Returns a {@link NextResponse} to short-circuit with when the request is NOT
 * authorized — 500 if `CRON_SECRET` is unset (server misconfig), 401 if the
 * `Authorization` header doesn't match — or `null` when the request is allowed
 * to proceed. The comparison is constant-time; the length-equality guard
 * short-circuits unequal lengths (it cannot leak the secret's bytes, only that
 * a wrong-length header was sent).
 *
 * Usage:
 *   const denied = assertCronAuthorized(request);
 *   if (denied) return denied;
 */
export function assertCronAuthorized(request: Request): NextResponse | null {
  const cronSecret = process.env["CRON_SECRET"];
  if (!cronSecret) {
    log.error("CRON_SECRET is not set");
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization");
  const authBuf = Buffer.from(authHeader ?? "", "utf-8");
  const expectedBuf = Buffer.from(`Bearer ${cronSecret}`, "utf-8");
  if (
    authBuf.length !== expectedBuf.length ||
    !timingSafeEqual(authBuf, expectedBuf)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
