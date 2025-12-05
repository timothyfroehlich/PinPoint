import type React from "react";
import Link from "next/link";
import Image from "next/image";
import { LayoutDashboard, Gamepad2, Settings, LogOut } from "lucide-react";
import { cn } from "~/lib/utils";
import { logoutAction } from "~/app/(auth)/actions";

const sidebarItems = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Machines",
    href: "/m",
    icon: Gamepad2,
  },
];

export function Sidebar({
  role,
}: {
  role?: "guest" | "member" | "admin" | undefined;
}): React.JSX.Element {
  // We'll use this for active state styling later if needed,
  // though for now simple hover effects might suffice for the "half-broken" phase.
  // const pathname = usePathname();

  return (
    <div
      role="navigation"
      aria-label="main navigation"
      data-testid="sidebar"
      className="flex h-screen w-64 flex-col border-r border-primary/50 bg-card text-card-foreground shadow-[0_0_15px_rgba(74,222,128,0.15)]"
    >
      {/* Logo Area */}
      <div className="flex h-40 items-start justify-start px-4 pt-6 border-b border-primary/20">
        <Link
          href="/dashboard"
          className="flex w-full items-start justify-start"
        >
          {/* APC Logo */}
          <Image
            src="/apc-logo.png"
            alt="Austin Pinball Collective"
            width={200}
            height={128}
            className="w-full h-auto max-h-32 object-contain drop-shadow-[0_0_8px_rgba(74,222,128,0.5)]"
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
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              "text-muted-foreground hover:bg-primary/10 hover:text-primary"
            )}
          >
            <item.icon className="size-4" />
            {item.title}
          </Link>
        ))}

        {role === "admin" && (
          <Link
            href="/admin/users"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              "text-muted-foreground hover:bg-primary/10 hover:text-primary"
            )}
          >
            <Settings className="size-4" />
            Admin
          </Link>
        )}
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
        {/* Sign Out */}
        <form action={logoutAction}>
          <button
            type="submit"
            data-testid="sidebar-signout"
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
