import { NextResponse } from "next/server";

import { getGlobalDatabaseProvider } from "~/server/db/provider";
import { getVersion } from "~/utils/version";

export async function GET(): Promise<NextResponse> {
  const dbProvider = getGlobalDatabaseProvider();
  const db = dbProvider.getClient();
  try {
    // Check database connectivity
    await db.$queryRaw`SELECT 1`;

    return NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      database: "connected",
      version: getVersion(),
    });
  } catch (error) {
    console.error("Health check failed:", error);

    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        database: "disconnected",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 },
    );
  } finally {
    await dbProvider.disconnect();
  }
}
