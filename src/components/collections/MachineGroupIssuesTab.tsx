import type React from "react";
import { IssueView } from "~/components/issues/view/IssueView";
import type { CollectionMachine } from "~/lib/collections/owner";
import type { Viewer } from "~/lib/collections/viewer";
import { loadIssueView } from "~/lib/issues/view/queries";
import { loadIssueViewSavedViews } from "~/lib/issues/view/saved-views";
import { toListSearchParams } from "~/lib/list-view/url-state";
import { getAccessLevel } from "~/lib/permissions/helpers";
import type { IssueExportScope } from "~/app/(app)/issues/export-schema";

interface MachineGroupIssuesTabProps {
  machines: CollectionMachine[];
  searchParams: Record<string, string | string[] | undefined>;
  viewer: Viewer;
  /** Names this tab's Surface so Export can resolve its scope on the server. */
  exportScope: IssueExportScope;
}

/**
 * Machine group Issues tab, shared by Collections, Owner Collections, and
 * tags (spec collections-and-tags 4.4): Issue View scoped to the group's
 * machines (issues-list §2.2). A group with no machines, or a Machine filter
 * that selects none of them, still shows the Summary Widgets, at zero, and
 * the list's empty state (issue-widgets §2.1).
 */
export async function MachineGroupIssuesTab({
  machines,
  searchParams: rawParams,
  viewer,
  exportScope,
}: MachineGroupIssuesTabProps): Promise<React.JSX.Element> {
  const searchParams = toListSearchParams(rawParams);
  const [{ savedViews }, result] = await Promise.all([
    loadIssueViewSavedViews("tab", searchParams),
    loadIssueView({
      searchParams,
      scope: machines.map((machine) => machine.initials),
    }),
  ]);
  return (
    <IssueView
      result={result}
      savedViews={savedViews}
      exportScope={exportScope}
      viewer={{
        userId: viewer.userId,
        accessLevel: getAccessLevel(viewer.role),
      }}
    />
  );
}
