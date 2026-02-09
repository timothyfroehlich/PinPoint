import { NextResponse } from "next/server";
import { cleanupOrphanedBlobs } from "~/lib/blob/cleanup";
import { log } from "~/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request): Promise<NextResponse> {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env["CRON_SECRET"]}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await cleanupOrphanedBlobs();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ error: message }, "Blob cleanup cron failed");
    return NextResponse.json(
      { error: "Cleanup failed", details: message },
      { status: 500 }
    );
  }
}
