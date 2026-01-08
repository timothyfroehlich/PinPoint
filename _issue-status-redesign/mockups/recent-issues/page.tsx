import type React from "react";
import Link from "next/link";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import {
  getIssueStatusLabel,
  getIssueStatusStyles,
  type IssueStatus,
} from "../badge-utils";

/**
 * Badge Preview - Recent Issues Panel (Report Form Sidebar)
 *
 * Shows how badges appear in the "Recent Issues" panel on the report form.
 * Shows: Status only (compact view)
 * Hides: Duplicate issues
 */

interface MockIssue {
  id: string;
  title: string;
  issueNumber: number;
  status: IssueStatus;
}

const mockRecentIssues: MockIssue[] = [
  {
    id: "1",
    title: "Left flipper not responding",
    issueNumber: 3,
    status: "in_progress",
  },
  {
    id: "2",
    title: "Ball stuck in Thing's box",
    issueNumber: 1,
    status: "needs_parts",
  },
  {
    id: "3",
    title: "Dim GI lighting on left side",
    issueNumber: 4,
    status: "confirmed",
  },
  {
    id: "4",
    title: "Bookcase target not registering",
    issueNumber: 2,
    status: "new",
  },
  {
    id: "5",
    title: "Bear Kick opto not working",
    issueNumber: 5,
    status: "fixed",
  },
  // This one would be HIDDEN (duplicate)
  // { id: "6", title: "Another issue", status: "duplicate" },
];

export default function RecentIssuesPanelPreviewPage(): React.JSX.Element {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Badge Preview - Recent Issues Panel</h1>
          <p className="text-muted-foreground">
            How badges appear in the &quot;Recent Issues&quot; sidebar on the report form.
            <br />
            Shows: <span className="text-primary">Status only</span> (compact).
            <span className="text-amber-400"> Hides duplicate issues.</span>
          </p>
          <Link href="/dev/badge-preview" className="text-primary hover:underline text-sm">
            ← Back to All Badges
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Desktop Version */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Desktop (Sidebar)</h2>
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm h-fit">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">
                  Recent Issues for The Addams Family
                </h3>
                <Link href="#" className="text-xs text-primary hover:underline font-medium">
                  View all →
                </Link>
              </div>

              <div className="space-y-2">
                {mockRecentIssues.map((issue) => (
                  <Link key={issue.id} href="#" className="block group">
                    <div className="flex items-center justify-between gap-3 rounded-md border border-transparent bg-muted/30 hover:border-border px-2 py-1.5 transition-all">
                      <p className="truncate text-xs font-medium text-foreground group-hover:text-primary transition-colors">
                        {issue.title}
                      </p>
                      <Badge
                        className={cn(
                          "px-1.5 py-0 text-[10px] h-4 font-semibold shrink-0 border",
                          getIssueStatusStyles(issue.status)
                        )}
                      >
                        {getIssueStatusLabel(issue.status)}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Mobile Version */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Mobile (Compact)</h2>
            <div className="rounded-xl border border-border bg-card p-3 shadow-sm h-fit">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-xs font-semibold text-foreground">
                  Recent Issues
                </h3>
                <Link href="#" className="text-[10px] text-primary hover:underline font-medium">
                  View all
                </Link>
              </div>

              <div className="space-y-1.5">
                {mockRecentIssues.slice(0, 3).map((issue) => (
                  <Link key={issue.id} href="#" className="block group">
                    <div className="flex items-center justify-between gap-2 rounded border border-transparent bg-muted/30 hover:border-border px-2 py-1 transition-all">
                      <p className="truncate text-[11px] font-medium text-foreground group-hover:text-primary transition-colors">
                        {issue.title}
                      </p>
                      <Badge
                        className={cn(
                          "px-1 py-0 text-[9px] h-3.5 font-semibold shrink-0 border",
                          getIssueStatusStyles(issue.status)
                        )}
                      >
                        {getIssueStatusLabel(issue.status)}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Show what hidden looks like */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold border-b border-border pb-2">
            Duplicate Issues (Hidden)
          </h2>
          <p className="text-sm text-muted-foreground">
            Issues with status &quot;Duplicate&quot; are NOT shown in the recent issues panel.
            This is intentional to avoid confusing public reporters.
          </p>
          <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-md border border-dashed border-border">
            <span className="text-sm text-muted-foreground line-through">Duplicate issue would appear here</span>
            <Badge
              className={cn(
                "px-1.5 py-0 text-[10px] h-4 font-semibold border opacity-50",
                getIssueStatusStyles("duplicate")
              )}
            >
              Duplicate
            </Badge>
            <span className="text-xs text-red-400">(hidden from public)</span>
          </div>
        </section>

        {/* Layout Notes */}
        <div className="p-4 bg-card rounded-lg border border-border space-y-2">
          <h3 className="font-semibold">Recent Issues Panel Layout Notes</h3>
          <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
            <li>Only <strong>Status</strong> badge shown (most compact possible)</li>
            <li>Severity, Priority, Consistency NOT shown (too cluttered for sidebar)</li>
            <li>Duplicate issues are filtered out from the query</li>
            <li>Mobile version shows fewer items (3 instead of 5)</li>
            <li>Very small badge size (text-[10px], h-4) to fit in compact layout</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
