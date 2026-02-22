"use client";

import type React from "react";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  AlertTriangle,
  Gamepad2,
  Plus,
  MoreVertical,
  HelpCircle,
  Info,
  MessageSquare,
  Sparkles,
  Settings,
} from "lucide-react";
import { cn } from "~/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "~/components/ui/sheet";
import { openFeedbackForm } from "~/components/feedback/FeedbackWidget";
import type { UserRole } from "~/lib/types";

interface BottomTabBarProps {
  role?: UserRole | undefined;
  /** The issues link path, read from cookie on the server */
  issuesPath?: string | undefined;
}

const mainTabs = [
  { title: "Dashboard", href: "/dashboard", icon: Home },
  { title: "Issues", href: "/issues", icon: AlertTriangle },
  { title: "Machines", href: "/m", icon: Gamepad2 },
  { title: "Report", href: "/report", icon: Plus },
] as const;

/** Returns true when the given tab should appear active for the current pathname. */
function isTabActive(
  tabHref: string,
  pathname: string,
  resolvedIssuesPath: string
): boolean {
  const href = tabHref === "/issues" ? resolvedIssuesPath : tabHref;
  const basePath = href.split("?")[0] ?? href;
  // Use prefix matching for paths that have sub-routes
  if (basePath === "/m" || basePath.startsWith("/issues")) {
    return pathname.startsWith(basePath);
  }
  return pathname === basePath;
}

export function BottomTabBar({
  role,
  issuesPath,
}: BottomTabBarProps): React.JSX.Element {
  const [moreOpen, setMoreOpen] = useState(false);
  const pathname = usePathname();
  const resolvedIssuesPath = issuesPath ?? "/issues";

  const sheetItemClass =
    "flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary";

  return (
    <>
      <nav
        role="navigation"
        aria-label="mobile navigation"
        data-testid="bottom-tab-bar"
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex border-t border-primary/50 bg-card/90 backdrop-blur-sm shadow-[0_-4px_15px_color-mix(in_srgb,var(--color-primary)_25%,transparent)]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {mainTabs.map((tab) => {
          const href = tab.href === "/issues" ? resolvedIssuesPath : tab.href;
          const active = isTabActive(tab.href, pathname, resolvedIssuesPath);
          return (
            <Link
              key={tab.href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs font-medium transition-colors min-h-[56px]",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-primary"
              )}
              aria-current={active ? "page" : undefined}
            >
              <tab.icon className="size-5" aria-hidden="true" />
              <span>{tab.title}</span>
            </Link>
          );
        })}

        {/* "More" tab — opens the bottom sheet */}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs font-medium transition-colors min-h-[56px]",
            moreOpen
              ? "text-primary"
              : "text-muted-foreground hover:text-primary"
          )}
          aria-label="More options"
          aria-expanded={moreOpen}
          aria-haspopup="dialog"
        >
          <MoreVertical className="size-5" aria-hidden="true" />
          <span>More</span>
        </button>
      </nav>

      {/* "More" bottom sheet */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-0">
          <div className="sr-only">
            <SheetTitle>More Options</SheetTitle>
            <SheetDescription>
              Additional navigation options and settings.
            </SheetDescription>
          </div>

          <nav
            aria-label="additional navigation"
            className="pt-2 pb-4 space-y-1"
          >
            <button
              type="button"
              onClick={() => {
                setMoreOpen(false);
                openFeedbackForm();
              }}
              className={sheetItemClass}
              data-testid="more-sheet-feedback"
            >
              <MessageSquare className="size-5 shrink-0" aria-hidden="true" />
              <span>Feedback</span>
            </button>

            <Link
              href="/help"
              onClick={() => setMoreOpen(false)}
              className={sheetItemClass}
              data-testid="more-sheet-help"
            >
              <HelpCircle className="size-5 shrink-0" aria-hidden="true" />
              <span>Help</span>
            </Link>

            <Link
              href="/whats-new"
              onClick={() => setMoreOpen(false)}
              className={sheetItemClass}
              data-testid="more-sheet-whats-new"
            >
              <Sparkles className="size-5 shrink-0" aria-hidden="true" />
              <span>What&apos;s New</span>
            </Link>

            <Link
              href="/about"
              onClick={() => setMoreOpen(false)}
              className={sheetItemClass}
              data-testid="more-sheet-about"
            >
              <Info className="size-5 shrink-0" aria-hidden="true" />
              <span>About</span>
            </Link>

            {role === "admin" && (
              <Link
                href="/admin/users"
                onClick={() => setMoreOpen(false)}
                className={sheetItemClass}
                data-testid="more-sheet-admin"
              >
                <Settings className="size-5 shrink-0" aria-hidden="true" />
                <span>Admin Panel</span>
              </Link>
            )}
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}
