"use client";

import type React from "react";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  LayoutDashboard,
  Gamepad2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "~/lib/utils";

const sidebarItems = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Machines",
    href: "/machines",
    icon: Gamepad2,
  },
  {
    title: "Issues",
    href: "/issues",
    icon: AlertCircle,
  },
];

export function Sidebar(): React.JSX.Element {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div
      role="navigation"
      aria-label="main navigation"
      data-testid="sidebar"
      className={cn(
        "flex min-h-screen h-full flex-col border-r border-primary/50 bg-card text-card-foreground shadow-[0_0_15px_rgba(74,222,128,0.15)] transition-all duration-300",
        isCollapsed ? "w-20" : "w-64"
      )}
    >
      {/* Logo Area */}
      <div
        className={cn(
          "flex items-center border-b border-primary/20 transition-all duration-300",
          isCollapsed
            ? "justify-center p-2 h-20"
            : "justify-start px-4 pt-6 h-40 items-start"
        )}
      >
        <Link
          href="/dashboard"
          className={cn(
            "flex w-full items-center",
            isCollapsed ? "justify-center" : "justify-start"
          )}
        >
          {/* APC Logo */}
          <Image
            src="/apc-logo.png"
            alt="Austin Pinball Collective"
            width={isCollapsed ? 48 : 200}
            height={isCollapsed ? 48 : 128}
            className={cn(
              "object-contain drop-shadow-[0_0_8px_rgba(74,222,128,0.5)] transition-all duration-300",
              isCollapsed ? "w-12 h-12" : "w-full h-auto max-h-32"
            )}
            priority
          />
        </Link>
      </div>

      {/* Navigation */}
      <div className="flex-1 py-6 px-4 space-y-1">
        {sidebarItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg py-2 text-sm font-medium transition-colors",
              "text-muted-foreground hover:bg-primary/10 hover:text-primary",
              isCollapsed ? "justify-center px-0" : "px-3"
            )}
            title={isCollapsed ? item.title : undefined}
          >
            <item.icon className="size-4 shrink-0" />
            {!isCollapsed && <span>{item.title}</span>}
          </Link>
        ))}
      </div>

      {/* Collapse Toggle */}
      <div className="border-t border-border p-4">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg py-2 text-sm font-medium transition-colors hover:bg-primary/10 hover:text-primary text-muted-foreground",
            isCollapsed ? "justify-center px-0" : "px-3"
          )}
          data-testid="sidebar-toggle"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight className="size-4" />
          ) : (
            <ChevronLeft className="size-4" />
          )}
          {!isCollapsed && <span>Collapse</span>}
        </button>
      </div>
    </div>
  );
}
