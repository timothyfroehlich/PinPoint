"use client";

import React from "react";
import { IsMobileProvider, useIsMobile } from "~/hooks/use-is-mobile";
import { cn } from "~/lib/utils";

/**
 * Mobile section tabs for the issue page (spec issue-detail §11): Issue,
 * Details, Other issues. In-page state, never a route — the URL never names a
 * tab, and every arrival opens on Issue (§11.2, §11.7). From `md:` up there
 * are no tabs and every panel shows in the two-pane layout (§12.4).
 *
 * `IssueSections` also reads the viewport flag once for the whole page
 * (`IsMobileProvider`), so the pickers and the title editor below it share
 * one media-query subscription.
 */

export type IssueSection = "issue" | "details" | "other";

const SECTIONS: { id: IssueSection; label: string }[] = [
  { id: "issue", label: "Issue" },
  { id: "details", label: "Details" },
  { id: "other", label: "Other issues" },
];

const SectionContext = React.createContext<{
  active: IssueSection;
  setActive: (section: IssueSection) => void;
} | null>(null);

function useSectionContext(): NonNullable<
  React.ContextType<typeof SectionContext>
> {
  const context = React.useContext(SectionContext);
  if (!context) {
    throw new Error("Issue section tabs must render inside IssueSections");
  }
  return context;
}

/** The section tab showing on mobile. */
export function useActiveIssueSection(): IssueSection {
  return useSectionContext().active;
}

export function IssueSections({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [active, setActive] = React.useState<IssueSection>("issue");

  // A link to a comment or event lives on the Issue tab (§2.5–§2.6).
  React.useEffect(() => {
    const onHashChange = (): void => {
      if (window.location.hash.startsWith("#comment-")) setActive("issue");
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const value = React.useMemo(() => ({ active, setActive }), [active]);
  return (
    <IsMobileProvider>
      <SectionContext.Provider value={value}>
        {children}
      </SectionContext.Provider>
    </IsMobileProvider>
  );
}

export function IssueSectionTabList({
  otherIssuesCount,
}: {
  otherIssuesCount: number;
}): React.JSX.Element {
  const { active, setActive } = useSectionContext();
  const listRef = React.useRef<HTMLDivElement>(null);

  const select = (section: IssueSection, focus = false): void => {
    setActive(section);
    const list = listRef.current;
    if (!list) return;
    if (focus) {
      list.querySelector<HTMLButtonElement>(`#issue-tab-${section}`)?.focus();
    }
    // After a long Activity, a shorter tab would open scrolled past its top.
    // The shell scrolls `<main>`, which starts below the app header.
    const scrollerTop = list.closest("main")?.getBoundingClientRect().top ?? 0;
    if (list.getBoundingClientRect().top < scrollerTop) {
      list.scrollIntoView({ block: "start" });
    }
  };

  const onKeyDown = (event: React.KeyboardEvent): void => {
    const index = SECTIONS.findIndex((section) => section.id === active);
    let nextIndex: number;
    switch (event.key) {
      case "ArrowRight":
        nextIndex = (index + 1) % SECTIONS.length;
        break;
      case "ArrowLeft":
        nextIndex = (index - 1 + SECTIONS.length) % SECTIONS.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = SECTIONS.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const next = SECTIONS[nextIndex];
    if (next) select(next.id, true);
  };

  return (
    // Hidden from `md:` up, which also removes the tab roles from the
    // accessibility tree on desktop.
    <div
      ref={listRef}
      role="tablist"
      aria-label="Issue sections"
      className="-mx-4 flex border-b border-outline-variant px-1 sm:-mx-8 md:hidden"
      data-testid="issue-section-tabs"
    >
      {SECTIONS.map((section) => {
        const isActive = section.id === active;
        return (
          <button
            key={section.id}
            id={`issue-tab-${section.id}`}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`issue-panel-${section.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => select(section.id)}
            onKeyDown={onKeyDown}
            className={cn(
              "-mb-px inline-flex min-h-11 items-center gap-1.5 border-b-2 px-3 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              isActive
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {section.label}
            {section.id === "other" ? (
              <span
                className="rounded-full bg-muted px-1.5 text-xs font-semibold text-muted-foreground"
                data-testid="other-issues-count"
              >
                {otherIssuesCount}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function IssueSectionPanel({
  section,
  className,
  children,
}: {
  section: IssueSection;
  className?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const { active } = useSectionContext();
  const isMobile = useIsMobile();

  return (
    <div
      id={`issue-panel-${section}`}
      // Panels are tab panels only while the tabs exist (below md:).
      role={isMobile ? "tabpanel" : undefined}
      aria-labelledby={isMobile ? `issue-tab-${section}` : undefined}
      className={cn(active !== section && "max-md:hidden", className)}
      data-testid={`issue-panel-${section}`}
    >
      {children}
    </div>
  );
}
