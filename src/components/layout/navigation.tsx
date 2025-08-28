import Link from "next/link";
import { Button } from "~/components/ui/button";
import {
  HomeIcon,
  AlertTriangleIcon,
  WrenchIcon,
  BarChart3Icon,
  SettingsIcon,
} from "lucide-react";
import type { ServerAuthContext } from "~/lib/auth/server-auth";
import { UserMenuClient } from "./client/UserMenuClient";
import { UniversalSearchInput } from "~/components/search";
import { NotificationBellWrapper } from "./notification-bell-wrapper";

interface NavigationProps {
  authContext: ServerAuthContext | null;
}

export function Navigation({ authContext }: NavigationProps) {
  if (!authContext) {
    // Unauthenticated navigation
    return (
      <nav className="border-b bg-white">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="text-xl font-bold">
              PinPoint
            </Link>

            <div className="flex items-center gap-4">
              <Button variant="ghost" asChild>
                <Link href="/auth/sign-in">Sign In</Link>
              </Button>
              <Button asChild>
                <Link href="/auth/sign-up">Sign Up</Link>
              </Button>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  // Authenticated navigation
  return (
    <nav className="border-b bg-white">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-xl font-bold">
              PinPoint
            </Link>

            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard" className="flex items-center gap-2">
                  <HomeIcon className="h-4 w-4" />
                  Dashboard
                </Link>
              </Button>

              <Button variant="ghost" size="sm" asChild>
                <Link href="/issues" className="flex items-center gap-2">
                  <AlertTriangleIcon className="h-4 w-4" />
                  Issues
                </Link>
              </Button>

              <Button variant="ghost" size="sm" asChild>
                <Link href="/machines" className="flex items-center gap-2">
                  <WrenchIcon className="h-4 w-4" />
                  Machines
                </Link>
              </Button>

              <Button variant="ghost" size="sm" asChild>
                <Link href="/analytics" className="flex items-center gap-2">
                  <BarChart3Icon className="h-4 w-4" />
                  Analytics
                </Link>
              </Button>

              <Button variant="ghost" size="sm" asChild>
                <Link href="/settings" className="flex items-center gap-2">
                  <SettingsIcon className="h-4 w-4" />
                  Settings
                </Link>
              </Button>
            </div>
          </div>

          {/* Global Search */}
          <div className="flex-1 max-w-md mx-6">
            <UniversalSearchInput
              placeholder="Search anything..."
              showSuggestions={true}
              showRecentSearches={true}
              maxSuggestions={5}
              className="w-full"
            />
          </div>

          <div className="flex items-center gap-3">
            {/* Notification Bell */}
            <NotificationBellWrapper userId={authContext.user.id} />

            <div className="text-right hidden md:block">
              <p className="text-sm font-medium">{authContext.user.name}</p>
              <p className="text-xs text-muted-foreground">
                {authContext.user.email}
              </p>
            </div>

            <UserMenuClient user={authContext.user} />
          </div>
        </div>
      </div>
    </nav>
  );
}
