"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "~/lib/utils";

/**
 * The container width a host's widgets need to sit side by side, about 20rem
 * each (widgets §2.3). Static class names, so Tailwind generates them.
 */
const SIDE_BY_SIDE_CLASSES = {
  2: "md:@min-[40rem]:grid-cols-2 md:@min-[40rem]:divide-x md:@min-[40rem]:divide-y-0",
  3: "md:@min-[60rem]:grid-cols-3 md:@min-[60rem]:divide-x md:@min-[60rem]:divide-y-0",
} as const;

/**
 * Phones: until the person chooses, CSS opens the section on screens at least
 * 390px wide (widgets §2.4), so the first paint needs no script. On wider
 * layouts the widgets always show and the toggle is hidden (§2.3).
 */
const CONTENT_VISIBILITY = {
  default: "hidden min-[390px]:grid md:grid",
  open: "grid",
  closed: "hidden md:grid",
} as const;

interface SummaryWidgetGroupProps {
  /** Browser storage key for this host's expanded/collapsed choice (§2.6). */
  storageKey: string;
  /** The Summary Row: the host's short figures (widgets §2.5). */
  summaryRow: React.ReactNode;
  /** How many widgets the host shows (its widgets spec §2.1). */
  widgetCount: keyof typeof SIDE_BY_SIDE_CLASSES;
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
 * Lays out a host's Summary Widgets (widgets spec §2). Wider layouts show
 * them expanded with no collapse control, side by side when the container
 * fits them and stacked full-width when it does not (a container query, not
 * a viewport breakpoint). Phones stack them in one collapsible section headed
 * by the Summary Row; the person's choice is remembered per host in this
 * browser, never in the URL or a Saved View (§2.6).
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

  return (
    <div
      ref={rootRef}
      className="@container border-b border-border md:border-b-0"
    >
      <button
        type="button"
        aria-expanded={expanded ?? undefined}
        aria-controls={contentId}
        onClick={toggle}
        className="flex min-h-11 w-full items-center gap-2 py-2 text-left text-sm text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:hidden"
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
          "grid-cols-1 pb-2 md:divide-y md:divide-border md:rounded-lg md:border md:border-border md:bg-card md:pb-0",
          CONTENT_VISIBILITY[visibility],
          SIDE_BY_SIDE_CLASSES[widgetCount]
        )}
      >
        {children}
      </div>
    </div>
  );
}
