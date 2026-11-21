"use client";

import type * as React from "react";
import { ListExportButton } from "~/components/list-view/ListExportButton";
import { exportIssuesAction } from "~/app/(app)/issues/export-action";
import type { IssueExportScope } from "~/app/(app)/issues/export-schema";

interface ExportButtonProps {
  /** The list's URL query; the server reads it exactly as the list does. */
  query: string;
  /** The Collection or Tag tab the list belongs to; the server resolves it. */
  scope?: IssueExportScope | undefined;
}

/**
 * Export in the Issues List Header (issues-list §5.4): a CSV of every issue
 * matching the current View Configuration across all pages, within the
 * Surface's scope.
 */
export function ExportButton({
  query,
  scope,
}: ExportButtonProps): React.JSX.Element {
  return (
    <ListExportButton
      exportCsv={() =>
        exportIssuesAction({
          query,
          ...(scope !== undefined && { scope }),
        })
      }
      emptyMessage="No issues to export."
    />
  );
}
