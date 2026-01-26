"use client";

import type React from "react";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Gamepad2,
  Settings,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  HelpCircle,
  Map as MapIcon,
} from "lucide-react";
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
}: {
  role?: "guest" | "member" | "admin" | undefined;
  onNavigate?: () => void;
  isMobile?: boolean;
}): React.JSX.Element {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  // Load state from localStorage on mount
  useEffect(() => {
    if (isMobile) return; // Don't load/save collapse state on mobile
    const savedState = window.localStorage.getItem("sidebar-collapsed");
    if (savedState) {
      setCollapsed(JSON.parse(savedState) as boolean);
    }
  }, [isMobile]);

  const toggleSidebar = (): void => {
    const newState = !collapsed;
    setCollapsed(newState);
    window.localStorage.setItem("sidebar-collapsed", JSON.stringify(newState));
  };

  const NavItem = ({
    item,
  }: {
    item: {
      title: string;
      href: string;
      icon: React.ElementType;
      variant?: string;
    };
  }): React.JSX.Element => {
    const isActive = pathname === item.href;
    const isReport = item.variant === "accent";

    const content = (
      <Link
        href={item.href}
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
          <Link
            href="/dashboard"
            {...(onNavigate ? { onClick: onNavigate } : {})}
            className="flex size-full items-center justify-center gap-2"
            aria-label={
              collapsed ? "PinPoint" : "PinPoint - Austin Pinball Collective"
            }
          >
            {collapsed ? (
              <Image
                src="/logo-pinpoint-transparent.png"
                alt="P"
                width={56}
                height={56}
                className="animate-in fade-in zoom-in duration-300 object-contain h-[56px] w-[56px]"
              />
            ) : (
              <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-4 duration-300">
                <Image
                  src="/logo-pinpoint-transparent.png"
                  alt="PinPoint"
                  width={50}
                  height={50}
                  className="object-contain h-[50px] w-[50px]"
                />
                <span className="text-xl font-bold tracking-tight text-foreground">
                  PinPoint
                </span>
                <Image
                  src="/apc-logo.png"
                  alt="Austin Pinball Collective"
                  width={64}
                  height={38}
                  className="h-9 w-auto object-contain opacity-90"
                />
              </div>
            )}
          </Link>
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
                title: "Help",
                href: "/help",
                icon: HelpCircle,
              }}
            />
            <NavItem
              item={{
                title: "Roadmap",
                href: "/roadmap",
                icon: MapIcon,
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
