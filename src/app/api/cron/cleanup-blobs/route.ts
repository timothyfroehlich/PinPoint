import { Buffer } from "node:buffer";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { cleanupOrphanedBlobs } from "~/lib/blob/cleanup";
import { log } from "~/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request): Promise<NextResponse> {
  const cronSecret = process.env["CRON_SECRET"];
  if (!cronSecret) {
    log.error("CRON_SECRET is not set");
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${cronSecret}`;
  const authBuf = Buffer.from(authHeader ?? "", "utf-8");
  const expectedBuf = Buffer.from(expected, "utf-8");
  if (
    authBuf.length !== expectedBuf.length ||
    !timingSafeEqual(authBuf, expectedBuf)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await cleanupOrphanedBlobs();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ error: message }, "Blob cleanup cron failed");
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }
}
