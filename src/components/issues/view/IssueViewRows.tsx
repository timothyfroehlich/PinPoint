"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  assignIssueAction,
  updateIssuePriorityAction,
  updateIssueSeverityAction,
  updateIssueStatusAction,
} from "~/app/(app)/issues/actions";
import {
  IssueListEntry,
  type IssueRowField,
  type UserOption,
} from "~/components/issues/IssueListEntry";
import { ALL_ISSUE_STATUSES } from "~/lib/issues/status";
import { checkPermission } from "~/lib/permissions/helpers";
import type { AccessLevel } from "~/lib/permissions/matrix";
import {
  ISSUE_PRIORITY_VALUES,
  ISSUE_SEVERITY_VALUES,
  type IssueListRow,
} from "~/lib/types";

/** Who is looking at the list, for per-row edit permissions (issues-list §3.5). */
export interface IssueRowsViewer {
  userId: string | undefined;
  accessLevel: AccessLevel;
}

const FIELD_LABELS: Record<IssueRowField, string> = {
  status: "Status",
  severity: "Severity",
  priority: "Priority",
  assignee: "Assignee",
};

/** Sends one row change to the matching server action. */
async function saveField(
  issueId: string,
  field: IssueRowField,
  value: string | null
): Promise<{ ok: true } | { ok: false; message: string }> {
  const formData = new FormData();
  formData.append("issueId", issueId);
  switch (field) {
    case "status":
      formData.append("status", value ?? "");
      return updateIssueStatusAction(undefined, formData);
    case "severity":
      formData.append("severity", value ?? "");
      return updateIssueSeverityAction(undefined, formData);
    case "priority":
      formData.append("priority", value ?? "");
      return updateIssuePriorityAction(undefined, formData);
    case "assignee":
      formData.append("assignedTo", value ?? "");
      return assignIssueAction(undefined, formData);
  }
}

/**
 * The rows to show after the server re-renders the same list (issues-list
 * §3.6): the current order, fresh values where the server returned the row,
 * then any rows that are new to the list.
 */
function keepRowsInPlace(
  current: IssueListRow[],
  fresh: IssueListRow[]
): IssueListRow[] {
  const freshById = new Map(fresh.map((row) => [row.id, row]));
  const shown = new Set(current.map((row) => row.id));
  return [
    ...current.map((row) => freshById.get(row.id) ?? row),
    ...fresh.filter((row) => !shown.has(row.id)),
  ];
}

/** A row with one field changed to the value just saved. */
function withField(
  row: IssueListRow,
  field: IssueRowField,
  value: string | null,
  users: readonly UserOption[]
): IssueListRow {
  switch (field) {
    case "status": {
      const status = ALL_ISSUE_STATUSES.find((s) => s === value);
      return status === undefined ? row : { ...row, status };
    }
    case "severity": {
      const severity = ISSUE_SEVERITY_VALUES.find((s) => s === value);
      return severity === undefined ? row : { ...row, severity };
    }
    case "priority": {
      const priority = ISSUE_PRIORITY_VALUES.find((p) => p === value);
      return priority === undefined ? row : { ...row, priority };
    }
    case "assignee": {
      const user = users.find((u) => u.id === value);
      return {
        ...row,
        assignedTo: user?.id ?? null,
        assignedToUser: user ? { id: user.id, name: user.name } : null,
      };
    }
  }
}

function fieldOf(issueId: string, cell: string | null): IssueRowField | null {
  if (cell === null || !cell.startsWith(`${issueId}-`)) return null;
  const field = cell.slice(issueId.length + 1);
  return field === "status" ||
    field === "severity" ||
    field === "priority" ||
    field === "assignee"
    ? field
    : null;
}

interface IssueViewRowsProps {
  rows: IssueListRow[];
  /**
   * Identifies the list the rows belong to: its View Configuration and
   * page. Rows keep their place until it changes (§3.6).
   */
  listKey: string;
  users: readonly UserOption[];
  viewer: IssueRowsViewer;
}

/**
 * The issue rows (issues-list §3): two lines each, editable in place by
 * people allowed to change the issue (§3.5). After a change from a row the
 * server re-renders the page with fresh rows, which may reorder the list or
 * drop the changed row from it; until the list next reloads — new filters,
 * sort, or page — the rows keep their place, take fresh values where the
 * server still returns the row, and keep the locally updated row where it
 * does not (§3.6).
 */
export function IssueViewRows({
  rows: serverRows,
  listKey,
  users,
  viewer,
}: IssueViewRowsProps): React.JSX.Element {
  const [, startTransition] = React.useTransition();
  // The one row field being saved, and the one that last failed (issueId-field).
  const [updatingCell, setUpdatingCell] = React.useState<string | null>(null);
  const [errorCell, setErrorCell] = React.useState<string | null>(null);

  const [rows, setRows] = React.useState(serverRows);
  const [rowsKey, setRowsKey] = React.useState(listKey);
  const [rowsSource, setRowsSource] = React.useState(serverRows);
  if (rowsKey !== listKey) {
    setRowsKey(listKey);
    setRowsSource(serverRows);
    setRows(serverRows);
  } else if (rowsSource !== serverRows) {
    setRowsSource(serverRows);
    setRows(keepRowsInPlace(rows, serverRows));
  }

  const handleUpdate = (
    issueId: string,
    field: IssueRowField,
    value: string | null
  ): void => {
    const cellKey = `${issueId}-${field}`;
    setUpdatingCell(cellKey);
    setErrorCell(null);
    startTransition(async () => {
      try {
        const result = await saveField(issueId, field, value);
        if (result.ok) {
          setRows((current) =>
            current.map((row) =>
              row.id === issueId ? withField(row, field, value, users) : row
            )
          );
          toast.success(`${FIELD_LABELS[field]} updated`);
        } else {
          toast.error(result.message);
          setErrorCell(cellKey);
        }
      } catch {
        toast.error(`Failed to update ${field}`);
        setErrorCell(cellKey);
      } finally {
        setUpdatingCell(null);
      }
    });
  };

  return (
    <ul aria-label="Issues" className="divide-y divide-outline-variant">
      {rows.map((issue) => {
        const ownership = {
          userId: viewer.userId,
          reporterId: issue.reportedByUser?.id ?? null,
          machineOwnerId: issue.machine.ownerId,
        };
        return (
          <IssueListEntry
            key={issue.id}
            issue={issue}
            canEditReporting={checkPermission(
              "issues.update.reporting",
              viewer.accessLevel,
              ownership
            )}
            canTriage={checkPermission(
              "issues.update.triage",
              viewer.accessLevel,
              ownership
            )}
            users={users}
            onUpdate={(field, value) => handleUpdate(issue.id, field, value)}
            updatingField={fieldOf(issue.id, updatingCell)}
            errorField={fieldOf(issue.id, errorCell)}
          />
        );
      })}
    </ul>
  );
}
