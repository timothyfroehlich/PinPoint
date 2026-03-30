"use client";

import type React from "react";
import { useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import {
  NotificationList,
  type EnrichedNotification,
} from "~/components/notifications/NotificationList";
import { UserMenu } from "~/components/layout/user-menu-client";
import { HeaderSignInButton } from "~/components/layout/header-sign-in-button";
import { HelpMenu } from "~/components/layout/HelpMenu";
import { isNavItemActive } from "~/components/layout/nav-utils";
import { NAV_ITEMS } from "~/components/layout/nav-config";
import type { UserRole } from "~/lib/types/user";

interface AppHeaderProps {
  isAuthenticated: boolean;
  userName?: string;
  role?: UserRole | undefined;
  notifications: EnrichedNotification[];
  issuesPath: string;
  newChangelogCount: number;
}

/**
 * Unified application header that replaces Sidebar + MobileHeader.
 *
 * Desktop (>= lg): Logo, APC logo, nav links (icon+text), Report Issue (icon+text), HelpMenu, auth.
 * Tablet (md–lg): Logo, nav links (icon-only), Report Issue (icon-only), HelpMenu, auth.
 * Mobile (< md): Logo, auth. Nav handled by BottomTabBar.
 */
export function AppHeader({
  isAuthenticated,
  userName,
  role,
  notifications,
  issuesPath,
  newChangelogCount,
}: AppHeaderProps): React.JSX.Element {
  const pathname = usePathname();
  const resolvedIssuesPath = issuesPath;

  const navLinks = useMemo(
    () =>
      NAV_ITEMS.map((item) => {
        const href = item.href === "/issues" ? resolvedIssuesPath : item.href;
        const active = isNavItemActive(item.href, pathname, resolvedIssuesPath);
        return { ...item, href, active };
      }),
    [pathname, resolvedIssuesPath]
  );

  return (
    <header
      className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-primary/50 bg-card/85 px-4 backdrop-blur-sm shadow-[0_0_15px_rgba(74,222,128,0.15)]"
      data-testid="app-header"
    >
      <Link
        href="/dashboard"
        className="flex items-center gap-2"
        aria-label="PinPoint"
      >
        <Image
          src="/logo-pinpoint-transparent.png"
          alt=""
          aria-hidden="true"
          width={32}
          height={32}
          className="size-8 object-contain"
          priority
        />
        <span className="text-base font-bold tracking-tight text-foreground">
          PinPoint
        </span>
      </Link>

      <a
        href="https://austinpinballcollective.org"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Austin Pinball Collective"
        className="hidden lg:block"
        data-testid="apc-logo-link"
      >
        <Image
          src="/apc-logo.png"
          alt="Austin Pinball Collective"
          width={64}
          height={38}
          className="h-7 w-auto object-contain shrink-0"
        />
      </a>

      <nav className="hidden md:flex items-center gap-1" aria-label="main">
        {navLinks.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium transition-colors lg:px-3",
              item.active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
            )}
            aria-current={item.active ? "page" : undefined}
            data-testid={`nav-${item.title.toLowerCase()}`}
            title={item.title}
          >
            <item.icon className="size-4 shrink-0" aria-hidden="true" />
            <span className="hidden lg:inline">{item.title}</span>
          </Link>
        ))}
      </nav>

      <div className="flex-1" />

      <div className="hidden md:flex items-center gap-2">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-primary gap-2"
          data-testid="nav-report-issue"
        >
          <Link href="/report">
            <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
            <span className="hidden lg:inline">Report Issue</span>
          </Link>
        </Button>
        <HelpMenu newChangelogCount={newChangelogCount} />
      </div>

      {isAuthenticated ? (
        <div className="flex items-center gap-2">
          <NotificationList notifications={notifications} />
          <UserMenu userName={userName ?? "User"} role={role} />
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <HeaderSignInButton />
          <Button
            asChild
            size="sm"
            className="text-xs px-3 h-8"
            data-testid="nav-signup"
          >
            <Link href="/signup">Sign Up</Link>
          </Button>
        </div>
      )}
    </header>
  );
}
