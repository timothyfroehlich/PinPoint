"use server";

import { and, eq } from "drizzle-orm";
import { format } from "date-fns";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";
import { log } from "~/lib/logger";
import { type Result, ok, err } from "~/lib/result";
import {
  buildWhereConditions,
  buildOrderBy,
} from "~/lib/issues/filters-queries";
import type { IssueFilters } from "~/lib/issues/filters";
import { generateCsv } from "~/lib/export/csv";
import { extractFirstParagraph } from "~/lib/tiptap/first-paragraph";
import {
  getIssueStatusLabel,
  getIssueSeverityLabel,
  getIssuePriorityLabel,
  getIssueFrequencyLabel,
} from "~/lib/issues/status";
import { formatIssueId } from "~/lib/issues/utils";
import { exportIssuesSchema, exportFiltersSchema } from "./export-schema";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";

export type ExportIssuesResult = Result<
  { csv: string; fileName: string },
  "UNAUTHORIZED" | "VALIDATION" | "SERVER" | "EMPTY"
>;

const CSV_HEADERS = [
  "Issue ID",
  "Machine",
  "Title",
  "Description",
  "Status",
  "Severity",
  "Priority",
  "Frequency",
  "Reporter",
  "Assigned To",
  "Created",
  "Updated",
  "Closed",
];

function formatDate(date: Date | null): string {
  if (!date) return "";
  return format(date, "yyyy-MM-dd");
}

export async function exportIssuesAction(input: {
  filtersJson?: string;
  machineInitials?: string;
}): Promise<ExportIssuesResult> {
  // 1. Auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err("UNAUTHORIZED", "You must be signed in to export issues.");
  }

  // 2. Validate input
  const inputValidation = exportIssuesSchema.safeParse(input);
  if (!inputValidation.success) {
    return err(
      "VALIDATION",
      inputValidation.error.issues[0]?.message ?? "Invalid input"
    );
  }
  const { filtersJson, machineInitials } = inputValidation.data;

  // 3. Parse filters
  let filters: IssueFilters = {};
  if (filtersJson) {
    try {
      const parsed = JSON.parse(filtersJson) as unknown;
      const filterValidation = exportFiltersSchema.safeParse(parsed);
      if (filterValidation.success) {
        filters = filterValidation.data;
      }
    } catch {
      // Invalid JSON — proceed with no filters (export all)
    }
  }

  // Machine-page export: override machine filter
  if (machineInitials) {
    filters.machine = [machineInitials];
    // Machine page exports ALL issues (no default status filter)
    // Set status to empty array to mean "all statuses"
    filters.status = [];
  }

  // Add currentUserId for watching filter
  filters.currentUserId = user.id;

  // Fetch user role for isAdmin check in buildWhereConditions
  const userProfile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
    columns: { role: true },
  });
  const isAdmin = userProfile?.role === "admin";

  try {
    // 4. Query issues
    const where = buildWhereConditions(filters, db, { isAdmin });
    const orderBy = buildOrderBy(filters.sort);

    const issueRows = await db.query.issues.findMany({
      where: and(...where),
      orderBy,
      with: {
        machine: { columns: { name: true } },
        reportedByUser: { columns: { name: true } },
        invitedReporter: { columns: { name: true } },
        assignedToUser: { columns: { name: true } },
      },
    });

    if (issueRows.length === 0) {
      return err("EMPTY", "No issues match the current filters.");
    }

    // 5. Build CSV rows
    const rows = issueRows.map((issue) => {
      const reporterName =
        issue.reportedByUser?.name ??
        issue.invitedReporter?.name ??
        issue.reporterName ??
        "Anonymous";

      return [
        formatIssueId(issue.machineInitials, issue.issueNumber),
        issue.machine.name,
        issue.title,
        extractFirstParagraph(
          issue.description as ProseMirrorDoc | string | null
        ),
        getIssueStatusLabel(issue.status),
        getIssueSeverityLabel(issue.severity),
        getIssuePriorityLabel(issue.priority),
        getIssueFrequencyLabel(issue.frequency),
        reporterName,
        issue.assignedToUser?.name ?? "",
        formatDate(issue.createdAt),
        formatDate(issue.updatedAt),
        formatDate(issue.closedAt),
      ];
    });

    // 6. Generate CSV
    const csv = generateCsv(CSV_HEADERS, rows);
    const dateStr = format(new Date(), "yyyy-MM-dd");
    const fileName = machineInitials
      ? `pinpoint-${machineInitials.toUpperCase()}-issues-${dateStr}.csv`
      : `pinpoint-issues-${dateStr}.csv`;

    return ok({ csv, fileName });
  } catch (error) {
    log.error({ error }, "Failed to export issues");
    return err("SERVER", "An error occurred while exporting issues.");
  }
}
