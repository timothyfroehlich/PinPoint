import type React from "react";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, AlertTriangle } from "lucide-react";
import { eq } from "drizzle-orm";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { issues } from "~/server/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { IssueActions } from "~/components/issues/IssueActions";
import { readFlash } from "~/lib/flash";

/**
 * Issue Detail Page (Protected Route)
 *
 * Shows issue details, timeline (system events + comments), and actions.
 */
export default async function IssueDetailPage({
  params,
}: {
  params: Promise<{ issueId: string }>;
}): Promise<React.JSX.Element> {
  // Auth guard (CORE-SEC-001)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Read flash message (if any)
  const flash = await readFlash();

  // Await params (Next.js 15+ requirement)
  const { issueId } = await params;

  // Query issue with all relations (direct Drizzle query - no DAL)
  const issue = await db.query.issues.findFirst({
    where: eq(issues.id, issueId),
    with: {
      machine: true,
      reportedByUser: true,
      assignedToUser: true,
      comments: {
        with: {
          author: true,
        },
        orderBy: (comments, { asc }) => [asc(comments.createdAt)],
      },
    },
  });

  // 404 if issue not found
  if (!issue) {
    notFound();
  }

  // Query all users for the assignee dropdown
  const users = await db.query.userProfiles.findMany({
    columns: {
      id: true,
      name: true,
    },
  });

  /**
   * Get severity badge styles
   */
  function getSeverityStyles(
    severity: "minor" | "playable" | "unplayable"
  ): string {
    const styles: Record<string, string> = {
      minor: "bg-success-container text-on-success-container border-success",
      playable: "bg-warning-container text-on-warning-container border-warning",
      unplayable: "bg-error-container text-on-error-container border-error",
    };
    return styles[severity] ?? "";
  }

  /**
   * Get status badge styles
   */
  function getStatusStyles(status: "new" | "in_progress" | "resolved"): string {
    const styles: Record<string, string> = {
      new: "bg-primary-container text-on-primary-container border-primary",
      in_progress:
        "bg-tertiary-container text-on-tertiary-container border-tertiary",
      resolved: "bg-success-container text-on-success-container border-success",
    };
    return styles[status] ?? "";
  }

  /**
   * Get status label
   */
  function getStatusLabel(status: "new" | "in_progress" | "resolved"): string {
    const labels: Record<string, string> = {
      new: "New",
      in_progress: "In Progress",
      resolved: "Resolved",
    };
    return labels[status] ?? status;
  }

  /**
   * Get severity label
   */
  function getSeverityLabel(
    severity: "minor" | "playable" | "unplayable"
  ): string {
    const labels: Record<string, string> = {
      minor: "Minor",
      playable: "Playable",
      unplayable: "Unplayable",
    };
    return labels[severity] ?? severity;
  }

  return (
    <main className="min-h-screen bg-surface">
      {/* Header */}
      <div className="border-b border-outline-variant bg-surface-container">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Link href="/issues">
              <Button
                variant="outline"
                size="sm"
                className="border-outline text-on-surface hover:bg-surface-variant"
              >
                <ArrowLeft className="mr-2 size-4" />
                Back
              </Button>
            </Link>
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-bold text-on-surface">
                  {issue.title}
                </h1>
                <Badge
                  className={`${getStatusStyles(issue.status)} border text-xs`}
                >
                  {getStatusLabel(issue.status)}
                </Badge>
                <Badge
                  className={`${getSeverityStyles(issue.severity)} border text-xs`}
                >
                  {getSeverityLabel(issue.severity)}
                </Badge>
              </div>
              <p className="text-sm text-on-surface-variant mt-1">
                Issue for {issue.machine.name}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Flash message */}
          {flash && (
            <div
              className={`rounded-lg px-4 py-3 text-sm ${
                flash.type === "error"
                  ? "bg-error-container text-on-error-container"
                  : "bg-primary-container text-on-primary-container"
              }`}
              role="alert"
            >
              {flash.message}
            </div>
          )}

          {/* Issue Details Card */}
          <Card className="border-outline-variant">
            <CardHeader>
              <CardTitle className="text-2xl text-on-surface">
                Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Description */}
              {issue.description && (
                <div>
                  <h3 className="text-sm font-medium text-on-surface-variant mb-2">
                    Description
                  </h3>
                  <p className="text-on-surface whitespace-pre-wrap">
                    {issue.description}
                  </p>
                </div>
              )}

              {/* Metadata Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-outline-variant">
                {/* Machine */}
                <div>
                  <p className="text-xs text-on-surface-variant mb-1">
                    Machine
                  </p>
                  <Link
                    href={`/machines/${issue.machine.id}`}
                    className="text-sm text-primary hover:underline font-medium"
                  >
                    {issue.machine.name}
                  </Link>
                </div>

                {/* Reported By */}
                <div>
                  <p className="text-xs text-on-surface-variant mb-1">
                    Reported By
                  </p>
                  <div className="flex items-center gap-2">
                    {issue.reportedByUser && (
                      <>
                        <Avatar className="size-6">
                          <AvatarFallback className="bg-primary text-on-primary text-xs">
                            {issue.reportedByUser.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .toUpperCase()
                              .slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm text-on-surface">
                          {issue.reportedByUser.name}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Created Date */}
                <div>
                  <p className="text-xs text-on-surface-variant mb-1">
                    Created
                  </p>
                  <div className="flex items-center gap-2">
                    <Calendar className="size-4 text-on-surface-variant" />
                    <span className="text-sm text-on-surface">
                      {new Date(issue.createdAt).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                </div>

                {/* Resolved Date */}
                {issue.resolvedAt && (
                  <div>
                    <p className="text-xs text-on-surface-variant mb-1">
                      Resolved
                    </p>
                    <div className="flex items-center gap-2">
                      <Calendar className="size-4 text-on-surface-variant" />
                      <span className="text-sm text-on-surface">
                        {new Date(issue.resolvedAt).toLocaleDateString(
                          undefined,
                          {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          }
                        )}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Actions Card */}
          <Card className="border-outline-variant">
            <CardHeader>
              <CardTitle className="text-2xl text-on-surface">
                Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <IssueActions
                issue={issue}
                users={users}
                assignedUser={issue.assignedToUser}
              />
            </CardContent>
          </Card>

          {/* Timeline Card */}
          <Card className="border-outline-variant">
            <CardHeader>
              <CardTitle className="text-2xl text-on-surface">
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              {issue.comments.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-on-surface-variant">
                    No timeline events yet
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {issue.comments.map((comment) => (
                    <div key={comment.id}>
                      {comment.isSystem ? (
                        /* System Event - Single line */
                        <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                          <AlertTriangle className="size-4" />
                          <span>{comment.content}</span>
                          <span className="text-xs">
                            {new Date(comment.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      ) : (
                        /* Regular Comment - Box with author and date */
                        <div className="p-4 rounded-lg bg-surface-variant border border-outline-variant">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {comment.author && (
                                <>
                                  <Avatar className="size-6">
                                    <AvatarFallback className="bg-primary text-on-primary text-xs">
                                      {comment.author.name
                                        .split(" ")
                                        .map((n) => n[0])
                                        .join("")
                                        .toUpperCase()
                                        .slice(0, 2)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-sm font-medium text-on-surface">
                                    {comment.author.name}
                                  </span>
                                </>
                              )}
                            </div>
                            <span className="text-xs text-on-surface-variant">
                              {new Date(comment.createdAt).toLocaleDateString(
                                undefined,
                                {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                }
                              )}
                            </span>
                          </div>
                          <p className="text-sm text-on-surface whitespace-pre-wrap">
                            {comment.content}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
