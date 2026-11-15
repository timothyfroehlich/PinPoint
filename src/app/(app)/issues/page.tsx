import type React from "react";
import { type Metadata } from "next";
import { redirect } from "next/navigation";
import { PageContainer } from "~/components/layout/PageContainer";
import { IssueView } from "~/components/issues/view/IssueView";
import { getViewer } from "~/lib/auth/viewer";
import { loadIssueView } from "~/lib/issues/view/queries";
import { loadIssueViewSavedViews } from "~/lib/issues/view/saved-views";
import { toListSearchParams } from "~/lib/list-view/url-state";
import { getAccessLevel } from "~/lib/permissions/helpers";

export const metadata: Metadata = {
  title: "Issues | PinPoint",
  description: "View and filter all pinball machine issues.",
};

interface IssuesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * The Issues page, Issue View's main page (issues-list §2.1, §2.3): every
 * issue, with no page action; reporting an issue stays in the app header and
 * tab bar.
 */
export default async function IssuesPage({
  searchParams,
}: IssuesPageProps): Promise<React.JSX.Element> {
  const [viewer, rawSearchParams] = await Promise.all([
    getViewer(),
    searchParams,
  ]);
  const viewSearchParams = toListSearchParams(rawSearchParams);
  const { savedViews, redirectTo } = await loadIssueViewSavedViews(
    "issues",
    viewSearchParams
  );
  if (redirectTo) redirect(redirectTo);
  const result = await loadIssueView({ searchParams: viewSearchParams });

  // Issue View draws the title row so the phone Summary Row toggle can sit
  // in it (list-views §3.1, §7.2).
  return (
    <PageContainer size="wide" className="max-md:pt-3">
      <IssueView
        result={result}
        savedViews={savedViews}
        title="Issues"
        viewer={{
          userId: viewer.userId,
          accessLevel: getAccessLevel(viewer.role),
        }}
      />
    </PageContainer>
  );
}
