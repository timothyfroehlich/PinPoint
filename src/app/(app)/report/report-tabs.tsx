"use client";

import type React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertCircle, ListPlus } from "lucide-react";
import { cn } from "~/lib/utils";

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

const TABS: readonly TabDef[] = [
  {
    href: "/report",
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

/**
 * Boxed, deep-linkable tab bar for the report page (spec §3). Route-driven, not
 * a stateful widget: each tab is a `<Link>` whose active state comes from
 * `usePathname()` + `aria-current="page"` (design-bible §5 "No shadcn `<Tabs>`").
 * The shared `ReportDraftProvider` in `report/layout.tsx` keeps the draft alive
 * across the sibling-route navigation, so switching tabs never remounts.
 *
 * Renders nothing without quick-report permission — anonymous reporters get the
 * single form only.
 */
export function ReportTabs({
  canQuick,
}: ReportTabsProps): React.JSX.Element | null {
  const pathname = usePathname();
  if (!canQuick) return null;

  return (
    <nav aria-label="Report mode" className="inline-flex">
      <div className="inline-flex gap-1 rounded-lg border border-outline-variant bg-muted p-1">
        {TABS.map(({ href, label, icon: Icon, testId }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              data-testid={`report-tab-${testId}`}
              className={cn(
                "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
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
  );
}
