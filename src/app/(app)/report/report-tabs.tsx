"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertCircle, ListPlus, Lock } from "lucide-react";
import { cn } from "~/lib/utils";
import { useReportDraft } from "./report-draft-store";

interface ReportTabsProps {
  /** Whether the viewer may use the Multiple (quick) grid. Anonymous/guest
   *  reporters lack it and see the single form with no tab chrome (spec §6). */
  canQuick: boolean;
}

interface TabDef {
  href: string;
  label: string;
  icon: typeof AlertCircle;
  testId: string;
}

const SINGLE_HREF = "/report";

const TABS: readonly TabDef[] = [
  {
    href: SINGLE_HREF,
    label: "Single issue",
    icon: AlertCircle,
    testId: "single",
  },
  {
    href: "/report/quick",
    label: "Multiple",
    icon: ListPlus,
    testId: "multiple",
  },
];

/** Approved copy for the one lock (spec §5): shown when the user taps the
 *  disabled Single tab while logging several issues. */
const LOCK_REASON =
  "You're logging several issues — remove the extras to go back to a single report.";

const TAB_BASE =
  "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors";

/**
 * Boxed, deep-linkable tab bar for the report page (spec §3). Route-driven, not
 * a stateful widget: each tab is a `<Link>` whose active state comes from
 * `usePathname()` + `aria-current="page"` (design-bible §5 "No shadcn `<Tabs>`").
 * The shared `ReportDraftProvider` in `report/layout.tsx` keeps the draft alive
 * across the sibling-route navigation, so switching tabs never remounts.
 *
 * The one lock (spec §5): with 2+ grid rows carrying real content, the Single
 * tab disables — you can't collapse several issues into one. Tapping it (works
 * on touch, no hover) reveals a one-line reason instead of navigating; dropping
 * back to a single content row re-enables it.
 *
 * Renders nothing without quick-report permission — anonymous reporters get the
 * single form only.
 */
export function ReportTabs({
  canQuick,
}: ReportTabsProps): React.JSX.Element | null {
  const pathname = usePathname();
  const { contentRowCount } = useReportDraft();
  const [showReason, setShowReason] = React.useState(false);

  const singleLocked = contentRowCount >= 2;
  // Auto-hide the reason the moment the lock clears, so a later re-lock starts
  // fresh (the reason only ever shows on an explicit tap).
  React.useEffect(() => {
    if (!singleLocked) setShowReason(false);
  }, [singleLocked]);

  if (!canQuick) return null;

  return (
    <div>
      <nav aria-label="Report mode" className="inline-flex">
        <div className="inline-flex gap-1 rounded-lg border border-outline-variant bg-muted p-1">
          {TABS.map(({ href, label, icon: Icon, testId }) => {
            const isActive = pathname === href;
            const testIdAttr = `report-tab-${testId}`;

            if (href === SINGLE_HREF && singleLocked) {
              // Disabled via aria-disabled (not the `disabled` attribute) so the
              // control stays focusable/tappable to reveal the reason.
              return (
                <button
                  key={href}
                  type="button"
                  aria-disabled="true"
                  data-testid={testIdAttr}
                  onClick={() => setShowReason((s) => !s)}
                  className={cn(
                    TAB_BASE,
                    "cursor-not-allowed text-muted-foreground/50"
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  {label}
                  <Lock className="size-3 shrink-0" aria-hidden="true" />
                </button>
              );
            }

            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? "page" : undefined}
                data-testid={testIdAttr}
                className={cn(
                  TAB_BASE,
                  isActive
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
      {singleLocked && showReason ? (
        <p role="status" className="mt-2 text-sm text-muted-foreground">
          {LOCK_REASON}
        </p>
      ) : null}
    </div>
  );
}
