import { type Metadata } from "next";
import { notFound } from "next/navigation";
import * as React from "react";

import { IssueDetailServer } from "~/components/issues/issue-detail-server";
import { requireServerAuth } from "~/lib/auth/server-auth";
import { getIssueById } from "~/lib/dal/issues";

interface IssuePageProps {
  params: Promise<{
    issueId: string;
  }>;
}

export async function generateMetadata({
  params,
}: IssuePageProps): Promise<Metadata> {
  try {
    const resolvedParams = await params;
    // Ensure authentication before generating metadata
    await requireServerAuth();
    const issue = await getIssueById(resolvedParams.issueId);

    return {
      title: `${issue.title} - PinPoint`,
      description: issue.description?.slice(0, 160) ?? "Issue details",
      openGraph: {
        title: issue.title,
        description: issue.description ?? "Issue details",
        type: "article",
      },
    };
  } catch {
    return {
      title: "Issue Not Found - PinPoint",
      description: "The requested issue could not be found.",
    };
  }
}

export default async function IssuePage({
  params,
}: IssuePageProps): Promise<React.JSX.Element> {
  try {
    // Authentication validation with automatic redirect - Phase 2C pattern
    await requireServerAuth();

    // Resolve params for issue ID
    const resolvedParams = await params;

    return (
      <main aria-label="Issue details" className="container mx-auto px-4 py-6">
        <IssueDetailServer issueId={resolvedParams.issueId} />
      </main>
    );
  } catch {
    // If issue doesn't exist or user doesn't have access, show 404
    notFound();
  }
}
