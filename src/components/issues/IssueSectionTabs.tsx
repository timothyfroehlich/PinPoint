"use client";

import React from "react";
import { useIsMobile } from "~/hooks/use-is-mobile";
import { cn } from "~/lib/utils";

/**
 * Mobile section tabs for the issue page (spec issue-detail §11): Issue,
 * Details, Other issues. In-page state, never a route — the URL never names a
 * tab, and every arrival opens on Issue (§11.2, §11.7). From `md:` up there
 * are no tabs and every panel shows in the two-pane layout (§12.4).
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
    <SectionContext.Provider value={value}>{children}</SectionContext.Provider>
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
    if (list.getBoundingClientRect().top < 0) {
      list.scrollIntoView({ block: "start" });
    }
  };

  const onKeyDown = (event: React.KeyboardEvent): void => {
    const index = SECTIONS.findIndex((section) => section.id === active);
    const step =
      event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = SECTIONS[(index + step + SECTIONS.length) % SECTIONS.length];
    if (next) select(next.id, true);
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label="Issue sections"
      className="-mx-4 flex scroll-mt-16 border-b border-outline-variant px-1 md:hidden"
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
                ? "border-primary text-foreground"
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
