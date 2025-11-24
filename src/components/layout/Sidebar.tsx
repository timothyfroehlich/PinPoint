"use client";

import type React from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Gamepad2,
  AlertCircle,
  Settings,
  LogOut,
  CircleDot,
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
  // We'll use this for active state styling later if needed,
  // though for now simple hover effects might suffice for the "half-broken" phase.
  // const pathname = usePathname();

  return (
    <div className="flex h-screen w-64 flex-col border-r border-border bg-card text-card-foreground">
      {/* Logo Area */}
      <div className="flex h-16 items-center px-6 border-b border-border">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 font-bold text-xl text-foreground"
        >
          <CircleDot className="size-6 text-primary" />
          <span>PinPoint</span>
        </Link>
      </div>

      {/* Navigation */}
      <div className="flex-1 py-6 px-4 space-y-1">
        {sidebarItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              "text-muted-foreground hover:bg-primary/10 hover:text-primary"
            )}
          >
            <item.icon className="size-4" />
            {item.title}
          </Link>
        ))}
      </div>

      {/* Footer / Settings */}
      <div className="border-t border-border p-4 space-y-1">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            "text-muted-foreground hover:bg-primary/10 hover:text-primary"
          )}
        >
          <Settings className="size-4" />
          Settings
        </Link>

        {/* Sign Out would typically be a form action, keeping it visual for now */}
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            )}
          >
            <LogOut className="size-4" />
            Sign Out
          </button>
        </form>
      </div>
    </div>
  );
}
