"use client";

import type React from "react";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
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
import { isNavItemActive } from "~/components/layout/nav-utils";
import { NAV_ITEMS } from "~/components/layout/nav-config";
import type { UserRole } from "~/lib/types";
import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";

interface BottomTabBarProps {
  role?: UserRole | undefined;
  /** The issues link path, read from cookie on the server */
  issuesPath?: string | undefined;
}

const bottomTabs = [
  ...NAV_ITEMS,
  { title: "Report", href: "/report", icon: Plus },
] as const;

const tabBaseClass =
  "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs font-medium transition-colors duration-150 min-h-[56px]";
const sheetItemClass =
  "flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-primary/10 hover:text-primary";

export function BottomTabBar({
  role,
  issuesPath,
}: BottomTabBarProps): React.JSX.Element {
  const [moreOpen, setMoreOpen] = useState(false);
  const pathname = usePathname();
  const resolvedIssuesPath = issuesPath ?? "/issues";

  return (
    <>
      <nav
        role="navigation"
        aria-label="mobile navigation"
        data-testid="bottom-tab-bar"
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex border-t border-primary/50 bg-card/90 backdrop-blur-sm shadow-[0_-4px_15px_color-mix(in_srgb,var(--color-primary)_25%,transparent)]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {bottomTabs.map((tab) => {
          const href = tab.href === "/issues" ? resolvedIssuesPath : tab.href;
          const active = isNavItemActive(
            tab.href,
            pathname,
            resolvedIssuesPath
          );
          return (
            <Link
              key={tab.href}
              href={href}
              className={cn(
                tabBaseClass,
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
            tabBaseClass,
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
              href="/whats-new"
              onClick={() => setMoreOpen(false)}
              className={sheetItemClass}
              data-testid="more-sheet-whats-new"
            >
              <Sparkles className="size-5 shrink-0" aria-hidden="true" />
              <span>What&apos;s New</span>
            </Link>

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
              href="/about"
              onClick={() => setMoreOpen(false)}
              className={sheetItemClass}
              data-testid="more-sheet-about"
            >
              <Info className="size-5 shrink-0" aria-hidden="true" />
              <span>About</span>
            </Link>

            {checkPermission("admin.access", getAccessLevel(role)) && (
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
