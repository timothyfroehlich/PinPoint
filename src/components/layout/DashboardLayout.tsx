import type React from "react";
import { Sidebar } from "./Sidebar";
import { UserMenu } from "./user-menu-client";
import type { User } from "@supabase/supabase-js";

interface DashboardLayoutProps {
  children: React.ReactNode;
  user?: User | null;
}

export function DashboardLayout({
  children,
  user,
}: DashboardLayoutProps): React.JSX.Element {
  // user_metadata is typed as any dictionary, so we cast to string safely
  const fullName = user?.user_metadata["full_name"] as string | undefined;
  const userName = fullName ?? user?.email ?? "User";
  const userEmail = user?.email ?? "";

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar - Hidden on mobile for MVP (or we can add a simple toggle later) */}
      <aside className="hidden md:block">
        <Sidebar />
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Header Area (Optional, for search/profile) */}
        <header className="flex h-16 items-center justify-between border-b border-border px-6 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
          <h1 className="text-lg font-semibold text-foreground">Dashboard</h1>
          {/* User Profile / Search */}
          {user ? (
            <UserMenu userName={userName} userEmail={userEmail} />
          ) : (
            <div className="size-8 rounded-full bg-muted animate-pulse" />
          )}
        </header>

        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
