import { NextResponse } from "next/server";
import { refreshPinTips } from "~/lib/pintips/records";
import { assertCronAuthorized } from "~/lib/cron/auth";
import { log } from "~/lib/logger";
import { db } from "~/server/db";

/**
 * Daily refresh of the stored PinTips copy (PP-a0be, spec pintips 2.2) from
 * Match Play's export, which is itself rebuilt once a day. CRON_SECRET-gated
 * like the other cron routes. A failure keeps the previous copy (spec 2.4).
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;

  try {
    const count = await refreshPinTips(db);
    log.info({ count, action: "pintips.refresh" }, "PinTips copy refreshed");
    return NextResponse.json({ ok: true, count });
  } catch (err) {
    log.error({ err }, "PinTips refresh cron failed");
    return NextResponse.json({ error: "Refresh failed" }, { status: 500 });
  }
}
