"use server";

import { and, eq } from "drizzle-orm";
import { createClient } from "~/lib/supabase/server";
import { siteDayOf } from "~/lib/time-zone";
import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";
import { serverActionError } from "~/lib/observability/report-error";
import { type Result, ok, err } from "~/lib/result";
import {
  buildWhereConditions,
  buildOrderBy,
} from "~/lib/issues/filters-queries";
import type { IssueFilters } from "~/lib/issues/filters";
import { issueFiltersForExport } from "~/lib/issues/view/queries";
import { generateCsv } from "~/lib/export/csv";
import { extractFirstParagraph } from "~/lib/tiptap/first-paragraph";
import { loadMentionNames } from "~/lib/tiptap/mention-names";
import { applyMentionNames } from "~/lib/tiptap/types";
import {
  getIssueStatusLabel,
  getIssueSeverityLabel,
  getIssuePriorityLabel,
  getIssueFrequencyLabel,
} from "~/lib/issues/status";
import { formatIssueId } from "~/lib/issues/utils";
import { exportIssuesSchema, type IssueExportScope } from "./export-schema";
import { resolveExportScopeInitials } from "./export-scope";

export type ExportIssuesResult = Result<
  { csv: string; fileName: string },
  "UNAUTHORIZED" | "VALIDATION" | "NOT_FOUND" | "SERVER" | "EMPTY"
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
  return siteDayOf(date);
}

/**
 * Exports every issue matching the list's View Configuration across all
 * pages, within the Surface's scope (issues-list §5.4): all issues on
 * `/issues`, one machine's issues from its page, or a Collection or Tag
 * tab's issues.
 */
export async function exportIssuesAction(input: {
  query?: string;
  machineInitials?: string;
  scope?: IssueExportScope;
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
  const { query, machineInitials, scope } = inputValidation.data;

  try {
    let filters: IssueFilters;
    // A Collection or Tag Issues tab's machines (issues-list §2.2, §5.4),
    // which the server resolves itself; no filter can widen them.
    let scopeInitials: string[] | undefined;
    if (machineInitials) {
      // Machine-page export: every issue on the machine, whatever its status
      // or presence.
      filters = { machine: [machineInitials], status: [], presence: [] };
    } else {
      // The list's own URL, parsed and validated exactly as the list does,
      // so the export is the list across every page.
      filters = await issueFiltersForExport(
        new URLSearchParams(query ?? ""),
        user.id
      );
      if (scope) {
        // The scope loaders run inside the try so a loader failure is
        // reported and returned as SERVER rather than thrown to the client.
        const resolved = await resolveExportScopeInitials(scope);
        if (resolved === null) {
          return err("NOT_FOUND", "This list is not available.");
        }
        scopeInitials = resolved;
      }
    }

    // Fetch user role for isAdmin check in buildWhereConditions
    const userProfile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, user.id),
      columns: { role: true },
    });
    const isAdmin = userProfile?.role === "admin"; // permissions-audit-allow: SQL row-level filtering, not a request gate

    // 4. Query issues
    const where = buildWhereConditions(filters, db, {
      isAdmin,
      scope: scopeInitials,
    });
    const orderBy = buildOrderBy(filters.sort, filters.dir);

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

    // 5. Build CSV rows. Mentions read as the mentioned person's current
    // name — one lookup for every exported description.
    const mentionNames = await loadMentionNames(
      issueRows.map((issue) => issue.description)
    );
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
          applyMentionNames(issue.description, mentionNames)
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
    const dateStr = siteDayOf(new Date());
    const fileName = machineInitials
      ? `pinpoint-${machineInitials.toUpperCase()}-issues-${dateStr}.csv`
      : `pinpoint-issues-${dateStr}.csv`;

    return ok({ csv, fileName });
  } catch (error) {
    return serverActionError(
      error,
      "SERVER",
      "An error occurred while exporting issues.",
      { action: "exportIssues" }
    );
  }
}
