import type React from "react";
import Link from "next/link";
import { CircleDot, AlertTriangle, Plus, Wrench } from "lucide-react";
import { createClient } from "~/lib/supabase/server";
import { Button } from "~/components/ui/button";
import { UserMenu } from "./user-menu-client";
import { cn } from "~/lib/utils";

/**
 * Navigation Component (Server Component)
 *
 * Top navigation bar with conditional rendering based on auth state:
 * - Unauthenticated: Logo + Sign In/Sign Up buttons
 * - Authenticated: Logo + Quick Links + User Menu
 */
export async function Navigation(): Promise<React.JSX.Element> {
  // Fetch auth user (CORE-SSR-002)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <nav
      data-testid="top-nav"
      className={cn(
        "w-full border-b border-outline-variant",
        user ? "bg-primary-container" : "bg-surface"
      )}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link
            href={user ? "/dashboard" : "/"}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <CircleDot
              className={cn(
                "size-6",
                user ? "text-on-primary-container" : "text-primary"
              )}
              strokeWidth={2.5}
            />
            <span
              className={cn(
                "text-xl font-bold",
                user ? "text-on-primary-container" : "text-primary"
              )}
            >
              PinPoint
            </span>
          </Link>

          {/* Authenticated State */}
          {user ? (
            <div className="flex items-center gap-6">
              {/* Quick Links - always visible on mobile per requirements */}
              <div className="flex items-center gap-2">
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="text-on-primary-container hover:bg-primary hover:text-on-primary"
                  aria-label="View Issues"
                >
                  <Link href="/issues" className="flex items-center gap-2">
                    <AlertTriangle className="size-4" />
                    <span className="hidden sm:inline">Issues</span>
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="text-on-primary-container hover:bg-primary hover:text-on-primary"
                  aria-label="Report Issue"
                >
                  <Link href="/issues/new" className="flex items-center gap-2">
                    <Plus className="size-4" />
                    <span className="hidden sm:inline">Report</span>
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="text-on-primary-container hover:bg-primary hover:text-on-primary hidden sm:flex"
                  aria-label="View Machines"
                >
                  <Link href="/machines" className="flex items-center gap-2">
                    <Wrench className="size-4" />
                    <span>Machines</span>
                  </Link>
                </Button>
              </div>

              {/* User Menu */}
              <UserMenu
                userName={
                  (user.user_metadata["name"] as string | undefined) ?? "User"
                }
                userEmail={user.email ?? ""}
              />
            </div>
          ) : (
            /* Unauthenticated State */
            <div className="flex items-center gap-3">
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="text-primary hover:bg-primary/10"
              >
                <Link href="/report">Report Issue</Link>
              </Button>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="text-on-surface hover:bg-surface-variant"
                data-testid="nav-signin"
              >
                <Link href="/login">Sign In</Link>
              </Button>
              <Button
                asChild
                size="sm"
                className="bg-primary text-on-primary hover:bg-primary-container hover:text-on-primary-container"
                data-testid="nav-signup"
              >
                <Link href="/signup">Sign Up</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
