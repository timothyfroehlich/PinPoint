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
  CircleDot,
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
  // {
  //   title: "Report Issue",
  //   href: "/report",
  //   icon: Wrench,
  //   variant: "accent",
  // },
];

export function Sidebar({
  role,
}: {
  role?: "guest" | "member" | "admin" | undefined;
}): React.JSX.Element {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  // Load state from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedState = window.localStorage.getItem("sidebar-collapsed");
      if (savedState) {
        setCollapsed(JSON.parse(savedState) as boolean);
      }
    }
  }, []);

  const toggleSidebar = (): void => {
    const newState = !collapsed;
    setCollapsed(newState);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        "sidebar-collapsed",
        JSON.stringify(newState)
      );
    }
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
        {!collapsed && <span>{item.title}</span>}
      </Link>
    );

    if (collapsed) {
      return (
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>{content}</TooltipTrigger>
            <TooltipContent side="right">
              <p>{item.title}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return content;
  };

  return (
    <div
      role="navigation"
      aria-label="main navigation"
      data-testid="sidebar"
      className={cn(
        "flex h-full flex-col border-r border-primary/50 bg-card text-card-foreground shadow-[0_0_15px_rgba(74,222,128,0.15)] transition-all duration-300 ease-in-out overflow-x-hidden",
        collapsed ? "w-[64px]" : "w-64"
      )}
    >
      {/* Logo Area */}
      <div
        className={cn(
          "flex h-24 items-center justify-center border-b border-primary/20 transition-all duration-300",
          collapsed ? "px-0" : "px-4"
        )}
      >
        <Link
          href="/dashboard"
          className="flex size-full items-center justify-center"
        >
          {collapsed ? (
            <CircleDot className="size-8 text-primary animate-in fade-in zoom-in duration-300" />
          ) : (
            <Image
              src="/apc-logo.png"
              alt="Austin Pinball Collective"
              width={160}
              height={100}
              className="w-auto h-20 object-contain drop-shadow-[0_0_8px_rgba(74,222,128,0.5)] animate-in fade-in slide-in-from-left-4 duration-300"
              priority
            />
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

      {/* Collapse Toggle */}
      <div className="border-t border-border p-2 flex justify-center">
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
              <span className="text-xs uppercase font-semibold">Collapse</span>
            </div>
          )}
        </Button>
      </div>
    </div>
  );
}
