"use client";

import type React from "react";
import { useState } from "react";
import { Settings, ChevronDown } from "lucide-react";
import { cn } from "~/lib/utils";
import { SidebarActions } from "~/components/issues/SidebarActions";
import { WatchButton } from "~/components/issues/WatchButton";
import { type IssueWithAllRelations } from "~/lib/types";
import { type OwnershipContext } from "~/lib/permissions/helpers";
import { type AccessLevel } from "~/lib/permissions/matrix";
import { resolveIssueReporter } from "~/lib/issues/utils";

interface MobileDetailsPanelProps {
  issue: IssueWithAllRelations;
  allUsers: { id: string; name: string }[];
  currentUserId: string | null;
  accessLevel: AccessLevel;
  ownershipContext: OwnershipContext;
}

/**
 * MobileDetailsPanel
 *
 * Collapsible panel for the issue detail page on mobile.
 * Renders a row with assignee display, watch count, and an "Edit Details" toggle.
 * Tapping "Edit Details" expands the details grid (replaces the sidebar on small screens).
 */
export function MobileDetailsPanel({
  issue,
  allUsers,
  currentUserId,
  accessLevel,
  ownershipContext,
}: MobileDetailsPanelProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);

  const reporter = resolveIssueReporter(issue);
  const assignedUser = issue.assignedToUser ?? null;
  const assigneeName = assignedUser?.name ?? "Unassigned";
  const assigneeInitials = assignedUser
    ? (assignedUser.name[0] ?? "U").toUpperCase()
    : "--";
  const watchCount = issue.watchers.length;
  const isWatching = currentUserId
    ? issue.watchers.some((w) => w.userId === currentUserId)
    : false;
  const reporterName = reporter.name;
  const reporterInitial = reporter.initial;

  return (
    <div data-testid="mobile-details-panel" className="md:hidden">
      {/* Assignee + Watch + Edit Details row */}
      <div className="flex items-center justify-between gap-3 py-3 border-y border-border">
        {/* Assignee display */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
            {assigneeInitials}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground leading-none">
              Assignee
            </span>
            <span className="text-sm font-medium text-foreground truncate">
              {assigneeName}
            </span>
          </div>
        </div>

        {/* Actions: watch count + edit details */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Watch count indicator */}
          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted text-muted-foreground text-xs">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-3.5"
              aria-hidden="true"
            >
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span>{watchCount}</span>
          </div>

          {/* Watch toggle (authenticated users only) */}
          {accessLevel !== "unauthenticated" && (
            <WatchButton issueId={issue.id} initialIsWatching={isWatching} />
          )}

          {/* Edit Details toggle button */}
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            aria-expanded={isOpen}
            aria-controls="mobile-details-content"
            className={cn(
              "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
              isOpen
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            <Settings className="size-3.5" aria-hidden="true" />
            <span>Edit Details</span>
            <ChevronDown
              className={cn(
                "size-3 transition-transform duration-200",
                isOpen && "rotate-180"
              )}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      {/* Collapsible panel content */}
      <div
        id="mobile-details-content"
        className={cn(
          "overflow-hidden transition-all duration-200 ease-in-out",
          isOpen ? "max-h-[80vh] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div
          className={cn(
            "mt-3 space-y-1 overflow-auto",
            isOpen && "rounded-xl border border-border bg-card p-4"
          )}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Edit Issue Details
          </p>
          <SidebarActions
            issue={issue}
            allUsers={allUsers}
            currentUserId={currentUserId}
            accessLevel={accessLevel}
            ownershipContext={ownershipContext}
          />

          {/* Reporter + Created at the bottom */}
          <div className="flex flex-wrap gap-4 pt-4 border-t border-border mt-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                Reporter
              </span>
              <div className="flex items-center gap-1.5">
                <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-medium text-muted-foreground">
                  {reporterInitial}
                </div>
                <span className="text-sm text-foreground">{reporterName}</span>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                Created
              </span>
              <span className="text-sm text-foreground">
                {new Date(issue.createdAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
