import { NextResponse } from "next/server";
import { inArray } from "drizzle-orm";

import { db } from "~/server/db";
import { issues, machines } from "~/server/db/schema";

interface CleanupPayload {
  issueIds?: unknown;
  machineIds?: unknown;
}

const toIdArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const uuidPattern = /^[0-9a-fA-F-]{36}$/u;
  const unique = new Set<string>();
  for (const entry of value) {
    if (typeof entry === "string" && uuidPattern.test(entry)) {
      unique.add(entry);
    }
  }
  return Array.from(unique);
};

export async function POST(request: Request): Promise<Response> {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: CleanupPayload;
  try {
    payload = (await request.json()) as CleanupPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const issueIds = toIdArray(payload.issueIds);
  const machineIds = toIdArray(payload.machineIds);

  if (!issueIds.length && !machineIds.length) {
    return NextResponse.json({ removedIssues: [], removedMachines: [] });
  }

  const removedIssues = issueIds.length
    ? (
        await db
          .delete(issues)
          .where(inArray(issues.id, issueIds))
          .returning({ id: issues.id })
      ).map((row) => row.id)
    : [];

  const removedMachines = machineIds.length
    ? (
        await db
          .delete(machines)
          .where(inArray(machines.id, machineIds))
          .returning({ id: machines.id })
      ).map((row) => row.id)
    : [];

  return NextResponse.json({ removedIssues, removedMachines });
}
