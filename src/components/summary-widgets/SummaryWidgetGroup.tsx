"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "~/lib/utils";
import {
  SIDE_BY_SIDE_LAYOUT,
  SummaryWidgetCountContext,
  type SummaryWidgetCount,
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

type Visibility = keyof typeof CONTENT_VISIBILITY;

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
 * The expanded/collapsed state of one host's stacked Summary Widgets, shared
 * by the group and any Summary Row toggle placed outside it (list-views §8.4
 * puts the toggle in the page title row whenever the widgets stack).
 */
export interface SummaryWidgetsController {
  /** How many widgets the host shows: the group and toggle switch together. */
  widgetCount: SummaryWidgetCount;
  contentId: string;
  contentRef: React.RefObject<HTMLDivElement | null>;
  /** null until the person chooses: CSS then decides. */
  choice: boolean | null;
  /** Whether the CSS default currently shows the section; null until measured. */
  defaultOpen: boolean | null;
  setDefaultOpen: (open: boolean) => void;
  toggle: () => void;
}

export function useSummaryWidgetsController(
  storageKey: string,
  widgetCount: SummaryWidgetCount
): SummaryWidgetsController {
  const contentId = React.useId();
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [choice, setChoice] = React.useState<boolean | null>(null);
  // Only drives aria-expanded, which CSS cannot set (CORE-RESP-002
  // boundary). The server cannot know the screen width, so its HTML leaves
  // aria-expanded out rather than state something CSS may contradict.
  const [defaultOpen, setDefaultOpen] = React.useState<boolean | null>(null);

  React.useLayoutEffect(() => {
    setChoice(readChoice(storageKey));
  }, [storageKey]);

  const toggle = React.useCallback((): void => {
    const content = contentRef.current;
    const shown =
      choice ??
      defaultOpen ??
      (content !== null && getComputedStyle(content).display !== "none");
    setChoice(!shown);
    writeChoice(storageKey, !shown);
  }, [choice, defaultOpen, storageKey]);

  return {
    widgetCount,
    contentId,
    contentRef,
    choice,
    defaultOpen,
    setDefaultOpen,
    toggle,
  };
}

function visibilityOf(controller: SummaryWidgetsController): Visibility {
  if (controller.choice === null) return "default";
  return controller.choice ? "open" : "closed";
}

/**
 * A Summary Row toggle placed outside its group, in the page title row
 * (list-views §7.2, §8.4). It shows exactly while the widgets stack, so it
 * must sit in a query container as wide as the group's; it expands and
 * collapses the stacked section and names the state for assistive
 * technology.
 */
export function SummaryRowToggle({
  controller,
  children,
  className,
}: {
  controller: SummaryWidgetsController;
  children: React.ReactNode;
  className?: string | undefined;
}): React.JSX.Element {
  const visibility = visibilityOf(controller);
  const expanded = controller.choice ?? controller.defaultOpen;
  return (
    <button
      type="button"
      aria-expanded={expanded ?? undefined}
      aria-controls={controller.contentId}
      onClick={controller.toggle}
      className={cn(
        "inline-flex min-h-11 min-w-0 items-center gap-1 rounded-md px-1.5 text-sm whitespace-nowrap text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        SIDE_BY_SIDE_LAYOUT[controller.widgetCount].toggleHidden,
        className
      )}
    >
      <span className="sr-only">Summary:</span>{" "}
      <span className="min-w-0 truncate">{children}</span>
      <ChevronDown
        aria-hidden="true"
        className={cn(
          "size-4 shrink-0 transition-transform motion-reduce:transition-none",
          visibility === "default" && "min-[390px]:rotate-180",
          visibility === "open" && "rotate-180"
        )}
      />
    </button>
  );
}

interface SummaryWidgetGroupProps {
  /** Browser storage key for this host's expanded/collapsed choice (§2.6). */
  storageKey: string;
  /** The Summary Row: the host's short figures (widgets §2.5). */
  summaryRow: React.ReactNode;
  /**
   * How many widgets the host shows (its widgets spec §2.1). A given
   * controller's count takes its place, so group and toggle always agree.
   */
  widgetCount: SummaryWidgetCount;
  /**
   * Shares state with a {@link SummaryRowToggle} rendered elsewhere. When
   * given, that toggle replaces the group's own at every stacked width.
   */
  controller?: SummaryWidgetsController | undefined;
  children: React.ReactNode;
}

/**
 * Lays out a host's Summary Widgets (widgets spec §2). At md+, when the
 * group's container fits them (a container query, not a viewport
 * breakpoint), they sit side by side in one card, always expanded, with no
 * collapse control. Everywhere else, phones included, they stack full-width
 * in one collapsible section with no card and no rules between widgets,
 * headed by the Summary Row unless a {@link SummaryRowToggle} in the title
 * row stands in for it (list-views §8.4). The person's choice is remembered
 * per host in this browser, never in the URL or a Saved View (§2.6), and
 * never hides side-by-side widgets.
 */
export function SummaryWidgetGroup({
  storageKey,
  summaryRow,
  widgetCount,
  controller: external,
  children,
}: SummaryWidgetGroupProps): React.JSX.Element {
  const own = useSummaryWidgetsController(storageKey, widgetCount);
  const controller = external ?? own;
  const rootRef = React.useRef<HTMLDivElement>(null);
  const { choice, contentRef, setDefaultOpen } = controller;

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
  }, [choice, contentRef, setDefaultOpen]);

  const expanded = choice ?? controller.defaultOpen;
  const visibility = visibilityOf(controller);
  const layout = SIDE_BY_SIDE_LAYOUT[controller.widgetCount];

  return (
    // The container the side-by-side queries measure; a container cannot
    // query itself, so the card lives on the wrapper inside.
    <div ref={rootRef} className="@container">
      <div
        className={cn(
          // A tab's stacked section is ruled off from the search beneath it.
          !external && "border-b border-border",
          layout.card
        )}
      >
        {external ? null : (
          <button
            type="button"
            aria-expanded={expanded ?? undefined}
            aria-controls={controller.contentId}
            onClick={controller.toggle}
            className={cn(
              "flex min-h-11 w-full items-center gap-2 py-2 text-left text-sm text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
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
        )}
        <div
          id={controller.contentId}
          ref={contentRef}
          className={cn(
            "grid-cols-1 divide-border pb-2",
            layout.content,
            CONTENT_VISIBILITY[visibility],
            layout.shown,
            layout.grid
          )}
        >
          <SummaryWidgetCountContext value={controller.widgetCount}>
            {children}
          </SummaryWidgetCountContext>
        </div>
      </div>
    </div>
  );
}
