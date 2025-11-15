import type React from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Clock } from "lucide-react";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { issues } from "~/server/db/schema";
import { eq, desc } from "drizzle-orm";
import { readFlash } from "~/lib/flash";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  updateIssueStatusAction,
  updateIssueSeverityAction,
  assignIssueAction,
} from "../actions";

/**
 * Issue Detail Page (Protected Route)
 *
 * Displays issue details, timeline, and update actions.
 */
export default async function IssueDetailPage({
  params,
}: {
  params: Promise<{ issueId: string }>;
}): Promise<React.JSX.Element> {
  // Auth guard
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get params (Next.js 16: params is a Promise)
  const { issueId } = await params;

  // Query issue with all relations
  const issue = await db.query.issues.findFirst({
    where: eq(issues.id, issueId),
    with: {
      machine: {
        columns: {
          id: true,
          name: true,
        },
      },
      reportedByUser: {
        columns: {
          id: true,
          name: true,
        },
      },
      assignedToUser: {
        columns: {
          id: true,
          name: true,
        },
      },
      comments: {
        orderBy: desc(issues.createdAt),
        with: {
          author: {
            columns: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!issue) {
    redirect("/issues");
  }

  // Fetch all users for assignment dropdown
  const allUsers = await db.query.userProfiles.findMany({
    columns: {
      id: true,
      name: true,
    },
  });

  // Read flash message
  const flash = await readFlash();

  return (
    <main className="min-h-screen bg-surface py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Flash message */}
        {flash && (
          <div
            className={`mb-6 rounded-md border px-4 py-3 text-sm ${
              flash.type === "error"
                ? "border-red-300 bg-red-50 text-red-800"
                : "border-green-300 bg-green-50 text-green-800"
            }`}
          >
            {flash.message}
          </div>
        )}

        {/* Back button */}
        <Link
          href="/issues"
          className="mb-4 inline-flex items-center gap-2 text-sm text-on-surface-variant hover:text-on-surface"
        >
          <ArrowLeft className="size-4" />
          Back to Issues
        </Link>

        {/* Issue Details Card */}
        <Card className="border-outline-variant bg-surface shadow-xl mb-6">
          <CardHeader>
            <div className="flex items-start justify-between gap-4 mb-4">
              <CardTitle className="text-3xl text-on-surface">
                {issue.title}
              </CardTitle>
              <div className="flex gap-2">
                {/* Status Badge */}
                <Badge
                  className={`px-2 py-1 text-xs font-semibold ${
                    issue.status === "resolved"
                      ? "bg-green-100 text-green-800 border-green-300"
                      : issue.status === "in_progress"
                        ? "bg-blue-100 text-blue-800 border-blue-300"
                        : "bg-gray-100 text-gray-800 border-gray-300"
                  }`}
                >
                  {issue.status === "in_progress"
                    ? "In Progress"
                    : issue.status.charAt(0).toUpperCase() +
                      issue.status.slice(1)}
                </Badge>
                {/* Severity Badge */}
                <Badge
                  className={`px-2 py-1 text-xs font-semibold ${
                    issue.severity === "unplayable"
                      ? "bg-red-100 text-red-800 border-red-300"
                      : issue.severity === "playable"
                        ? "bg-yellow-100 text-yellow-800 border-yellow-300"
                        : "bg-blue-100 text-blue-800 border-blue-300"
                  }`}
                >
                  {issue.severity.charAt(0).toUpperCase() +
                    issue.severity.slice(1)}
                </Badge>
              </div>
            </div>

            {/* Metadata */}
            <div className="space-y-2 text-sm text-on-surface-variant">
              <div>
                <strong>Machine:</strong>{" "}
                <Link
                  href={`/machines/${issue.machine.id}`}
                  className="text-primary hover:underline"
                >
                  {issue.machine.name}
                </Link>
              </div>
              <div>
                <strong>Reported by:</strong>{" "}
                {issue.reportedByUser?.name ?? "Unknown"}
              </div>
              <div>
                <strong>Reported:</strong>{" "}
                {new Date(issue.createdAt).toLocaleString()}
              </div>
              {issue.assignedToUser && (
                <div>
                  <strong>Assigned to:</strong> {issue.assignedToUser.name}
                </div>
              )}
              {issue.resolvedAt && (
                <div>
                  <strong>Resolved:</strong>{" "}
                  {new Date(issue.resolvedAt).toLocaleString()}
                </div>
              )}
            </div>
          </CardHeader>

          {issue.description && (
            <CardContent>
              <p className="text-on-surface whitespace-pre-wrap">
                {issue.description}
              </p>
            </CardContent>
          )}
        </Card>

        {/* Update Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Update Status */}
          <Card className="border-outline-variant">
            <CardHeader>
              <CardTitle className="text-sm text-on-surface">
                Update Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form action={updateIssueStatusAction}>
                <input type="hidden" name="issueId" value={issue.id} />
                <Select name="status" defaultValue={issue.status} required>
                  <SelectTrigger className="border-outline-variant bg-surface text-on-surface mb-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="submit"
                  size="sm"
                  className="w-full bg-primary text-on-primary"
                >
                  Update
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Update Severity */}
          <Card className="border-outline-variant">
            <CardHeader>
              <CardTitle className="text-sm text-on-surface">
                Update Severity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form action={updateIssueSeverityAction}>
                <input type="hidden" name="issueId" value={issue.id} />
                <Select name="severity" defaultValue={issue.severity} required>
                  <SelectTrigger className="border-outline-variant bg-surface text-on-surface mb-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minor">Minor</SelectItem>
                    <SelectItem value="playable">Playable</SelectItem>
                    <SelectItem value="unplayable">Unplayable</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="submit"
                  size="sm"
                  className="w-full bg-primary text-on-primary"
                >
                  Update
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Assign to User */}
          <Card className="border-outline-variant">
            <CardHeader>
              <CardTitle className="text-sm text-on-surface">
                Assign Issue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form action={assignIssueAction}>
                <input type="hidden" name="issueId" value={issue.id} />
                <Select name="assignedTo" defaultValue={issue.assignedTo ?? ""}>
                  <SelectTrigger className="border-outline-variant bg-surface text-on-surface mb-3">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Unassigned</SelectItem>
                    {allUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="submit"
                  size="sm"
                  className="w-full bg-primary text-on-primary"
                >
                  Update
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Timeline */}
        <Card className="border-outline-variant bg-surface shadow-xl">
          <CardHeader>
            <CardTitle className="text-xl text-on-surface">Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            {issue.comments.length === 0 ? (
              <p className="text-sm text-on-surface-variant italic">
                No timeline events yet
              </p>
            ) : (
              <div className="space-y-3">
                {issue.comments.map((comment) =>
                  comment.isSystem ? (
                    // System event - single line
                    <div
                      key={comment.id}
                      className="flex items-center gap-2 text-sm text-on-surface-variant"
                    >
                      <Clock className="size-3" />
                      <span>{comment.content}</span>
                      <span className="text-xs">
                        {new Date(comment.createdAt).toLocaleString()}
                      </span>
                    </div>
                  ) : (
                    // Regular comment - box with author and time
                    <Card
                      key={comment.id}
                      className="border-outline-variant bg-surface-container"
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-semibold text-on-surface">
                            {comment.author?.name ?? "Unknown User"}
                          </div>
                          <div className="text-xs text-on-surface-variant">
                            {new Date(comment.createdAt).toLocaleString()}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-on-surface whitespace-pre-wrap">
                          {comment.content}
                        </p>
                      </CardContent>
                    </Card>
                  )
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
