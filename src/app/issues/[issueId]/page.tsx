import { type Metadata } from "next";
import { notFound } from "next/navigation";
import * as React from "react";

import { IssueDetailServer } from "~/components/issues/issue-detail-server";
import { getRequestAuthContext } from "~/server/auth/context";

interface IssuePageProps {
  params: Promise<{
    issueId: string;
  }>;
}

export async function generateMetadata({
  params,
}: IssuePageProps): Promise<Metadata> {
  // Generic metadata to avoid auth race conditions - specific details set at page level
  const resolvedParams = await params;
  return {
    title: `Issue ${resolvedParams.issueId} - PinPoint`,
    description: "Issue details and management",
  };
}

export default async function IssuePage({
  params,
}: IssuePageProps): Promise<React.JSX.Element> {
  try {
    // Single authentication resolution for entire request
    const authContext = await getRequestAuthContext();

    if (authContext.kind !== "authorized") {
      throw new Error("Member access required");
    }

    // Resolve params for issue ID
    const resolvedParams = await params;

    return (
      <main aria-label="Issue details" className="container mx-auto px-4 py-6">
        <IssueDetailServer issueId={resolvedParams.issueId} organizationId={authContext.org.id} userId={authContext.user.id} />
      </main>
    );
  } catch {
    // If issue doesn't exist or user doesn't have access, show 404
    notFound();
  }
}
