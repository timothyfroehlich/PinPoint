"use client";

import * as React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "~/lib/utils";

interface SummaryWidgetGroupProps {
  /** Browser storage key for this host's expanded/collapsed choice. */
  storageKey: string;
  /** The collapsed Summary Row: one short figure per widget (widgets §2.5). */
  summaryRow: string;
  children: React.ReactNode;
}

function readExpanded(storageKey: string): boolean {
  try {
    return window.localStorage.getItem(storageKey) === "expanded";
  } catch {
    return false;
  }
}

function writeExpanded(storageKey: string, expanded: boolean): void {
  try {
    window.localStorage.setItem(
      storageKey,
      expanded ? "expanded" : "collapsed"
    );
  } catch {
    // Storage can be unavailable (private mode, blocked site data); the
    // choice then lasts only for this page view.
  }
}

/**
 * Lays out a host's Summary Widgets (widgets spec §2): one row of equal
 * columns from `md:` up, and on phones a collapsible section that starts
 * collapsed as the Summary Row. The phone choice is remembered per host.
 */
export function SummaryWidgetGroup({
  storageKey,
  summaryRow,
  children,
}: SummaryWidgetGroupProps): React.JSX.Element {
  const contentId = React.useId();
  const [expanded, setExpanded] = React.useState(false);

  React.useEffect(() => {
    setExpanded(readExpanded(storageKey));
  }, [storageKey]);

  function toggle(): void {
    const next = !expanded;
    setExpanded(next);
    writeExpanded(storageKey, next);
  }

  const Chevron = expanded ? ChevronUp : ChevronDown;

  return (
    <div className="border-b border-border">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={toggle}
        className="flex min-h-11 w-full items-center gap-2 py-2 text-left text-sm font-medium text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:hidden"
      >
        <span className="min-w-0 flex-1">
          {expanded ? "Summary" : summaryRow}
        </span>
        <Chevron
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground"
        />
      </button>
      <div
        id={contentId}
        className={cn(
          "grid-cols-1 divide-y divide-border md:grid md:auto-cols-fr md:grid-flow-col md:divide-x md:divide-y-0",
          expanded ? "grid" : "hidden"
        )}
      >
        {children}
      </div>
    </div>
  );
}
