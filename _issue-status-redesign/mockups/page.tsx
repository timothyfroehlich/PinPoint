import type React from "react";
import Link from "next/link";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import {
  ALL_STATUSES,
  ALL_SEVERITIES,
  ALL_PRIORITIES,
  ALL_CONSISTENCIES,
  ALL_STATUS_GROUPS,
  getIssueStatusLabel,
  getIssueStatusStyles,
  getIssueStatusGroup,
  getIssueStatusGroupLabel,
  getIssueStatusGroupStyles,
  getIssueSeverityLabel,
  getIssueSeverityStyles,
  getIssuePriorityLabel,
  getIssuePriorityStyles,
  getIssueConsistencyLabel,
  getIssueConsistencyStyles,
  getStatusesForGroup,
} from "./badge-utils";

/**
 * Badge Preview - All Badges Reference
 *
 * Shows every possible badge value with its styling.
 * Navigate to /dev/badge-preview to view.
 */
export default function BadgePreviewPage(): React.JSX.Element {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-12">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Badge Preview - All Values</h1>
          <p className="text-muted-foreground">
            Reference for all badge types and their visual styles.
          </p>
          <div className="flex gap-4 text-sm flex-wrap">
            <Link href="/dev/badge-preview/grid-mockups" className="text-primary hover:underline">
              Grid Mockups (Icons, Layouts) →
            </Link>
            <Link href="/dev/badge-preview/dropdown-mockups" className="text-primary hover:underline">
              Dropdown Mockups (With Search) →
            </Link>
            <Link href="/dev/badge-preview/filter-mockups" className="text-primary hover:underline">
              Filter Mockups (Issue List) →
            </Link>
            <Link href="/dev/badge-preview/dashboard" className="text-primary hover:underline">
              Dashboard Preview →
            </Link>
            <Link href="/dev/badge-preview/issue-list" className="text-primary hover:underline">
              Issue List Preview →
            </Link>
            <Link href="/dev/badge-preview/issue-detail" className="text-primary hover:underline">
              Issue Detail Preview →
            </Link>
            <Link href="/dev/badge-preview/recent-issues" className="text-primary hover:underline">
              Recent Issues Panel →
            </Link>
            <Link href="/dev/badge-preview/report-form" className="text-primary hover:underline">
              Report Form →
            </Link>
            <Link href="/dev/badge-preview/presentation" className="text-primary hover:underline font-bold">
              User Presentation →
            </Link>
          </div>
        </div>

        {/* Status Badges by Group */}
        <section className="space-y-6">
          <h2 className="text-xl font-semibold border-b border-border pb-2">
            Status Badges (Grouped)
          </h2>

          {ALL_STATUS_GROUPS.map((group) => (
            <div key={group} className="space-y-3">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  {getIssueStatusGroupLabel(group)} Group
                </h3>
                <Badge className={cn("text-xs border", getIssueStatusGroupStyles(group))}>
                  Group Badge
                </Badge>
              </div>
              <div className="flex flex-wrap gap-3">
                {getStatusesForGroup(group).map((status) => (
                  <div key={status} className="flex flex-col items-center gap-1">
                    <Badge className={cn("px-3 py-1 text-xs font-semibold border", getIssueStatusStyles(status))}>
                      {getIssueStatusLabel(status)}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground font-mono">{status}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>

        {/* Severity Badges */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold border-b border-border pb-2">
            Severity Badges
          </h2>
          <p className="text-sm text-muted-foreground">
            How bad is the problem? (Player-centric language)
          </p>
          <div className="flex flex-wrap gap-4">
            {ALL_SEVERITIES.map((severity) => (
              <div key={severity} className="flex flex-col items-center gap-1">
                <Badge className={cn("px-3 py-1 text-xs font-semibold border", getIssueSeverityStyles(severity))}>
                  {getIssueSeverityLabel(severity)}
                </Badge>
                <span className="text-[10px] text-muted-foreground font-mono">{severity}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Priority Badges */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold border-b border-border pb-2">
            Priority Badges
          </h2>
          <p className="text-sm text-muted-foreground">
            How urgent to fix? (Members/Admins only)
          </p>
          <div className="flex flex-wrap gap-4">
            {ALL_PRIORITIES.map((priority) => (
              <div key={priority} className="flex flex-col items-center gap-1">
                <Badge className={cn("px-3 py-1 text-xs font-semibold border", getIssuePriorityStyles(priority))}>
                  {getIssuePriorityLabel(priority)}
                </Badge>
                <span className="text-[10px] text-muted-foreground font-mono">{priority}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Consistency Badges */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold border-b border-border pb-2">
            Consistency Badges
          </h2>
          <p className="text-sm text-muted-foreground">
            How often does it happen? (Public input, shown on Issue Detail & Issue List only)
          </p>
          <div className="flex flex-wrap gap-4">
            {ALL_CONSISTENCIES.map((consistency) => (
              <div key={consistency} className="flex flex-col items-center gap-1">
                <Badge className={cn("px-3 py-1 text-xs font-semibold border", getIssueConsistencyStyles(consistency))}>
                  {getIssueConsistencyLabel(consistency)}
                </Badge>
                <span className="text-[10px] text-muted-foreground font-mono">{consistency}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Size Variations */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold border-b border-border pb-2">
            Size Variations
          </h2>
          <p className="text-sm text-muted-foreground">
            Different badge sizes for different contexts.
          </p>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground w-24">Small (lists):</span>
              <Badge className={cn("px-1.5 py-0 text-[10px] h-4 font-semibold border", getIssueStatusStyles("in_progress"))}>
                Work in Progress
              </Badge>
              <Badge className={cn("px-1.5 py-0 text-[10px] h-4 font-semibold border", getIssueSeverityStyles("major"))}>
                Major
              </Badge>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground w-24">Medium:</span>
              <Badge className={cn("px-2 py-0.5 text-xs font-semibold border", getIssueStatusStyles("in_progress"))}>
                Work in Progress
              </Badge>
              <Badge className={cn("px-2 py-0.5 text-xs font-semibold border", getIssueSeverityStyles("major"))}>
                Major
              </Badge>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground w-24">Large (detail):</span>
              <Badge className={cn("px-3 py-1 text-xs font-semibold border", getIssueStatusStyles("in_progress"))}>
                Work in Progress
              </Badge>
              <Badge className={cn("px-3 py-1 text-xs font-semibold border", getIssueSeverityStyles("major"))}>
                Major
              </Badge>
            </div>
          </div>
        </section>

        {/* Legend */}
        <section className="space-y-4 p-4 bg-card rounded-lg border border-border">
          <h2 className="text-lg font-semibold">Color Meaning Legend</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-cyan-400">● Cyan/Teal</span>
              <p className="text-muted-foreground text-xs">New group statuses</p>
            </div>
            <div>
              <span className="text-fuchsia-400">● Purple/Magenta</span>
              <p className="text-muted-foreground text-xs">In Progress group</p>
            </div>
            <div>
              <span className="text-zinc-400">● Gray</span>
              <p className="text-muted-foreground text-xs">Closed/Low/Cosmetic/Unsure</p>
            </div>
            <div>
              <span className="text-green-400">● Green</span>
              <p className="text-muted-foreground text-xs">Fixed (success)</p>
            </div>
            <div>
              <span className="text-sky-400">● Sky Blue</span>
              <p className="text-muted-foreground text-xs">Minor/Intermittent</p>
            </div>
            <div>
              <span className="text-amber-400">● Amber/Yellow</span>
              <p className="text-muted-foreground text-xs">Major/Medium/Warning</p>
            </div>
            <div>
              <span className="text-orange-400">● Orange</span>
              <p className="text-muted-foreground text-xs">Frequent</p>
            </div>
            <div>
              <span className="text-red-400">● Red</span>
              <p className="text-muted-foreground text-xs">Unplayable/High/Constant</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
