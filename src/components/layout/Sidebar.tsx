"use client";

import type React from "react";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { storeSidebarCollapsed } from "~/lib/cookies/client";
import {
  LayoutDashboard,
  Gamepad2,
  Settings,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  HelpCircle,
  Info,
  Sparkles,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";

const sidebarItems = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Issues",
    href: "/issues",
    icon: AlertTriangle,
  },
  {
    title: "Machines",
    href: "/m",
    icon: Gamepad2,
  },
];

export function Sidebar({
  role,
  onNavigate,
  isMobile = false,
  issuesPath,
  initialCollapsed = false,
  newChangelogCount = 0,
}: {
  role?: "guest" | "member" | "technician" | "admin" | undefined;
  onNavigate?: () => void;
  isMobile?: boolean;
  /** The issues link path, read from cookie on the server */
  issuesPath?: string | undefined;
  /** Initial collapsed state, read from cookie on the server */
  initialCollapsed?: boolean;
  /** Number of unread changelog entries, computed in MainLayout */
  newChangelogCount?: number;
}): React.JSX.Element {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const pathname = usePathname();
  // Default to /issues if no path provided
  const resolvedIssuesPath = issuesPath ?? "/issues";

  const toggleSidebar = (): void => {
    const newState = !collapsed;
    setCollapsed(newState);
    // Persist to cookie synchronously
    storeSidebarCollapsed(newState);
  };

  const NavItem = ({
    item,
  }: {
    item: {
      title: string;
      href: string;
      icon: React.ElementType;
      variant?: string;
      badge?: number;
    };
  }): React.JSX.Element => {
    const href = item.href === "/issues" ? resolvedIssuesPath : item.href;
    const hrefPath = href.split("?")[0];
    const isActive = pathname === hrefPath;
    const isReport = item.variant === "accent";
    const badgeCount = item.badge ?? 0;
    const badgeLabel = badgeCount > 20 ? "20+" : badgeCount.toString();

    const content = (
      <Link
        href={href}
        {...(onNavigate ? { onClick: onNavigate } : {})}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors relative group",
          isActive
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-primary/10 hover:text-primary",
          isReport && !collapsed
            ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground mt-4 mb-2 justify-center"
            : "",
          collapsed && "justify-center px-2"
        )}
      >
        <item.icon
          className={cn(
            "shrink-0",
            collapsed ? "size-5" : "size-4",
            isReport && !collapsed ? "text-primary-foreground" : ""
          )}
        />
        <span className={cn(collapsed && "sr-only")}>{item.title}</span>
        {badgeCount > 0 && !collapsed && (
          <Badge
            variant="default"
            className="ml-auto text-[10px] px-1.5 py-0 min-w-[20px] h-5"
          >
            {badgeLabel}
          </Badge>
        )}
        {badgeCount > 0 && collapsed && (
          <span className="absolute top-1 right-1 size-2 rounded-full bg-primary" />
        )}
      </Link>
    );

    if (collapsed) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side="right">
            <p>{item.title}</p>
          </TooltipContent>
        </Tooltip>
      );
    }

    return content;
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div
        role="navigation"
        aria-label="main navigation"
        data-testid="sidebar"
        className={cn(
          "flex h-full flex-col border-r border-primary/50 bg-card text-card-foreground shadow-[0_0_15px_rgba(74,222,128,0.15)] transition-all duration-300 ease-in-out overflow-x-hidden",
          collapsed ? "w-[64px]" : "w-64",
          isMobile && "w-full border-r-0 shadow-none" // Full width and no border/shadow on mobile sheet
        )}
      >
        {/* Logo Area */}
        <div
          className={cn(
            "flex h-16 items-center justify-center border-b border-primary/20 transition-all duration-300",
            collapsed ? "px-0" : "px-4"
          )}
        >
          {collapsed ? (
            <Link
              href="/dashboard"
              {...(onNavigate ? { onClick: onNavigate } : {})}
              className="flex size-full items-center justify-center gap-2"
              aria-label="PinPoint"
            >
              <Image
                src="/logo-pinpoint-transparent.png"
                alt="P"
                width={56}
                height={56}
                className="animate-in fade-in zoom-in duration-300 object-contain h-[56px] w-[56px]"
                priority
              />
            </Link>
          ) : (
            <div className="flex items-center justify-between w-full px-2 animate-in fade-in slide-in-from-left-4 duration-300">
              <Link
                href="/dashboard"
                {...(onNavigate ? { onClick: onNavigate } : {})}
                className="flex items-center gap-2 min-w-0"
                aria-label="PinPoint - Austin Pinball Collective"
              >
                <Image
                  src="/logo-pinpoint-transparent.png"
                  alt="PinPoint"
                  width={50}
                  height={50}
                  className="object-contain h-[50px] w-[50px] shrink-0"
                  priority
                />
                <span className="text-xl font-bold tracking-tight text-foreground">
                  PinPoint
                </span>
              </Link>
              <a
                href="https://austinpinballcollective.org"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Austin Pinball Collective"
                {...(onNavigate ? { onClick: onNavigate } : {})}
              >
                <Image
                  src="/apc-logo.png"
                  alt="Austin Pinball Collective"
                  width={64}
                  height={38}
                  className="h-9 w-auto object-contain shrink-0"
                />
              </a>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex-1 py-6 px-2 space-y-1 overflow-y-auto scrollbar-thin">
          {sidebarItems.map((item) => (
            <NavItem key={item.href} item={item} />
          ))}

          {role === "admin" && (
            <NavItem
              item={{
                title: "Admin",
                href: "/admin/users",
                icon: Settings,
              }}
            />
          )}
        </div>

        {/* Help + Collapse (bottom) */}
        <div className="border-t border-border px-2 pt-3 pb-2 space-y-2">
          <div className="space-y-1">
            <NavItem
              item={{
                title: "What's New",
                href: "/whats-new",
                icon: Sparkles,
                badge: newChangelogCount,
              }}
            />
            <NavItem
              item={{
                title: "Help",
                href: "/help",
                icon: HelpCircle,
              }}
            />
            <NavItem
              item={{
                title: "About",
                href: "/about",
                icon: Info,
              }}
            />
          </div>

          {!isMobile && (
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSidebar}
              className="w-full h-10 hover:bg-primary/10 hover:text-primary"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <ChevronRight className="size-4" />
              ) : (
                <div className="flex items-center gap-2">
                  <ChevronLeft className="size-4" />
                  <span className="text-xs uppercase font-semibold">
                    Collapse
                  </span>
                </div>
              )}
            </Button>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
