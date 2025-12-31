import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { issues } from "~/server/db/schema";
import { eq, desc } from "drizzle-orm";
import { log } from "~/lib/logger";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ initials: string }> }
): Promise<NextResponse> {
  const { initials } = await params;

  if (!initials) {
    return NextResponse.json(
      { error: "Machine initials required" },
      { status: 400 }
    );
  }

  try {
    const recentIssues = await db.query.issues.findMany({
      where: eq(issues.machineInitials, initials),
      orderBy: [desc(issues.createdAt)],
      limit: 5,
      columns: {
        id: true,
        issueNumber: true,
        title: true,
        status: true,
        createdAt: true,
      },
    });

    return NextResponse.json(recentIssues);
  } catch (error) {
    log.error({ error, initials }, "Failed to fetch recent issues");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
