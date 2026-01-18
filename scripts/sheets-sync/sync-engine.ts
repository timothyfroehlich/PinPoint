import { type SyncIssue, type SheetRow } from "./types";
import { issues, issueComments } from "../../src/server/db/schema";
import { eq } from "drizzle-orm";
import { type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "../../src/server/db/schema";

export interface SyncAction {
  type: "create_in_db" | "update_db" | "update_sheet" | "conflict" | "none";
  row: SheetRow;
  issue: SyncIssue;
  reason?: string;
  changes?: Record<string, { from: string; to: string }>;
}

export class SyncEngine {
  constructor(private db: PostgresJsDatabase<typeof schema>) {}

  determineAction(
    row: SheetRow,
    issue: SyncIssue,
    dbIssue: typeof issues.$inferSelect | null,
    lastCachedRow: SheetRow | null
  ): SyncAction {
    if (!dbIssue) {
      return { type: "create_in_db", row, issue };
    }

    if (lastCachedRow) {
      // One-way sync: Sheet always wins if it changed since last cached state
      const sheetChanged =
        row.description !== lastCachedRow.description ||
        row.fixStatus !== lastCachedRow.fixStatus ||
        row.severity !== lastCachedRow.severity ||
        row.consistency !== lastCachedRow.consistency ||
        row.game !== lastCachedRow.game;

      if (sheetChanged) {
        return { type: "update_db", row, issue };
      }
    }

    return { type: "none", row, issue };
  }

  async createInDB(issue: SyncIssue): Promise<string> {
    return await this.db.transaction(async (tx) => {
      // 1. Get and increment issue number
      const [machine] = await tx
        .select({ nextIssueNumber: schema.machines.nextIssueNumber })
        .from(schema.machines)
        .where(eq(schema.machines.initials, issue.machineInitials));

      if (!machine)
        throw new Error(`Machine ${issue.machineInitials} not found`);

      const issueNumber = machine.nextIssueNumber;

      // 2. Create the issue
      const [newIssue] = await tx
        .insert(issues)
        .values({
          machineInitials: issue.machineInitials,
          issueNumber,
          title: issue.title,
          description: issue.description,
          status: issue.status,
          severity: issue.severity,
          consistency: issue.consistency,
          reporterEmail: issue.reporterEmail,
          createdAt: issue.createdAt,
          updatedAt: new Date(),
        })
        .returning({ id: issues.id });

      if (!newIssue) throw new Error("Failed to create issue");

      // 3. Increment next issue number
      await tx
        .update(schema.machines)
        .set({ nextIssueNumber: issueNumber + 1 })
        .where(eq(schema.machines.initials, issue.machineInitials));

      return newIssue.id;
    });
  }

  async updateInDB(issue: SyncIssue): Promise<void> {
    if (!issue.id) throw new Error("Missing issue ID for update");

    await this.db
      .update(issues)
      .set({
        title: issue.title,
        description: issue.description,
        status: issue.status,
        severity: issue.severity,
        consistency: issue.consistency,
        updatedAt: new Date(),
      })
      .where(eq(issues.id, issue.id));
  }

  async syncWorkLog(issueId: string, workLog: string): Promise<boolean> {
    if (!workLog || workLog.trim() === "") return false;

    // Check if this work log entry already exists as a comment
    const existingComment = await this.db.query.issueComments.findFirst({
      where: (comments, { and, eq }) =>
        and(eq(comments.issueId, issueId), eq(comments.content, workLog)),
    });

    if (existingComment) {
      return false; // Skip duplicate
    }

    // Add new comment
    await this.db.insert(issueComments).values({
      issueId,
      content: workLog,
      isSystem: false, // It's from a human in the sheet
    });

    return true;
  }
}
