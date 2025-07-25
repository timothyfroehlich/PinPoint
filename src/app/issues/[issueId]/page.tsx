import { type Metadata } from "next";
import { notFound } from "next/navigation";
import * as React from "react";

import { IssueDetailView } from "~/components/issues/IssueDetailView";
import { auth } from "~/server/auth";
import { api } from "~/trpc/server";

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
    const issue = await api.issue.core.getById({ id: resolvedParams.issueId });

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
  const session = await auth();

  try {
    // Fetch issue data on the server
    const resolvedParams = await params;
    const issue = await api.issue.core.getById({ id: resolvedParams.issueId });

    // Check if user has permission to view this issue
    // For now, we'll allow public access and let the component handle permissions

    return (
      <main aria-label="Issue details">
        <IssueDetailView
          issue={issue}
          session={session}
          issueId={resolvedParams.issueId}
        />
      </main>
    );
  } catch {
    // If issue doesn't exist or user doesn't have access, show 404
    notFound();
  }
}
