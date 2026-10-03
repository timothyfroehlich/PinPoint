"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "~/lib/utils";
import {
  SIDE_BY_SIDE_LAYOUT,
  type SummaryWidgetCount,
  SummaryWidgetLayoutContext,
} from "./layout";

/**
 * Until the person chooses, CSS opens the stacked section on screens at least
 * 390px wide (widgets §2.4), so the first paint needs no script. Side-by-side
 * widgets always show (§2.3): the group adds its `shown` class to each state.
 */
const CONTENT_VISIBILITY = {
  default: "hidden min-[390px]:grid",
  open: "grid",
  closed: "hidden",
} as const;

interface SummaryWidgetGroupProps {
  /** Browser storage key for this host's expanded/collapsed choice (§2.6). */
  storageKey: string;
  /** The Summary Row: the host's short figures (widgets §2.5). */
  summaryRow: React.ReactNode;
  /** How many widgets the host shows (its widgets spec §2.1). */
  widgetCount: SummaryWidgetCount;
  children: React.ReactNode;
}

function readChoice(storageKey: string): boolean | null {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored === "expanded") return true;
    if (stored === "collapsed") return false;
  } catch {
    // Storage can be unavailable (private mode, blocked site data).
  }
  return null;
}

function writeChoice(storageKey: string, expanded: boolean): void {
  try {
    window.localStorage.setItem(
      storageKey,
      expanded ? "expanded" : "collapsed"
    );
  } catch {
    // Without storage the choice lasts only for this page view.
  }
}

/**
 * Lays out a host's Summary Widgets (widgets spec §2). At md+, when the
 * group's container fits them (a container query, not a viewport
 * breakpoint), they sit side by side, always expanded, with no collapse
 * control. Everywhere else, phones included, they stack full-width in one
 * collapsible section headed by the Summary Row; the person's choice is
 * remembered per host in this browser, never in the URL or a Saved View
 * (§2.6), and never hides side-by-side widgets. The widgets read the same
 * side-by-side condition from context, so the headline and breakdown follow
 * it (§5.1, §5.7).
 */
export function SummaryWidgetGroup({
  storageKey,
  summaryRow,
  widgetCount,
  children,
}: SummaryWidgetGroupProps): React.JSX.Element {
  const contentId = React.useId();
  const rootRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  // null until the person chooses: CSS then decides (CONTENT_VISIBILITY).
  const [choice, setChoice] = React.useState<boolean | null>(null);
  // Whether the CSS default currently shows the section; only drives
  // aria-expanded, which CSS cannot set (CORE-RESP-002 boundary). null until
  // measured: the server cannot know the screen width, so its HTML leaves
  // aria-expanded out rather than state something CSS may contradict.
  const [defaultOpen, setDefaultOpen] = React.useState<boolean | null>(null);

  React.useLayoutEffect(() => {
    setChoice(readChoice(storageKey));
  }, [storageKey]);

  React.useLayoutEffect(() => {
    const root = rootRef.current;
    const content = contentRef.current;
    if (!root || !content || choice !== null) return;
    const measure = (): void => {
      setDefaultOpen(getComputedStyle(content).display !== "none");
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [choice]);

  const expanded = choice ?? defaultOpen;

  function toggle(): void {
    const content = contentRef.current;
    const shown =
      expanded ??
      (content !== null && getComputedStyle(content).display !== "none");
    setChoice(!shown);
    writeChoice(storageKey, !shown);
  }

  const visibility = choice === null ? "default" : choice ? "open" : "closed";
  const layout = SIDE_BY_SIDE_LAYOUT[widgetCount];

  return (
    // The container the side-by-side queries measure; a container cannot
    // query itself, so the card and rules live on the wrapper inside.
    <div ref={rootRef} className="@container">
      <div className="border-b border-border md:rounded-lg md:border md:bg-card">
        <button
          type="button"
          aria-expanded={expanded ?? undefined}
          aria-controls={contentId}
          onClick={toggle}
          className={cn(
            "flex min-h-11 w-full items-center gap-2 py-2 text-left text-sm text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:px-4 md:focus-visible:ring-inset",
            layout.toggleHidden
          )}
        >
          <span className="sr-only">Summary:</span>{" "}
          <span className="min-w-0 flex-1">{summaryRow}</span>
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "size-4 shrink-0 transition-transform",
              visibility === "default" && "min-[390px]:rotate-180",
              visibility === "open" && "rotate-180"
            )}
          />
        </button>
        <div
          id={contentId}
          ref={contentRef}
          className={cn(
            "grid-cols-1 pb-2 md:divide-y md:divide-border md:border-t md:border-border md:pb-0",
            layout.noTopRule,
            CONTENT_VISIBILITY[visibility],
            layout.shown,
            layout.grid
          )}
        >
          <SummaryWidgetLayoutContext.Provider value={layout}>
            {children}
          </SummaryWidgetLayoutContext.Provider>
        </div>
      </div>
    </div>
  );
}
