import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Suspense } from "react";
import {
  AlertTriangleIcon,
  WrenchIcon,
  MapPinIcon,
  ShieldIcon,
  PlusIcon,
} from "lucide-react";
import type { OrganizationContext } from "~/lib/organization-context";
import { UserMenuClient } from "./client/UserMenuClient";
import { UniversalSearchInput } from "~/components/search";
import { NotificationBellWrapper } from "./notification-bell-wrapper";

interface NavigationProps {
  organizationContext: OrganizationContext | null;
}

export function Navigation({ organizationContext }: NavigationProps) {
  if (!organizationContext || !organizationContext.user) {
    // Unauthenticated navigation - using Material 3 surface colors
    return (
      <nav className="border-b border-outline-variant bg-surface">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="text-xl font-bold text-on-surface">
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

  // Authenticated navigation - using Material 3 primary container for light purple
  return (
    <nav className="border-b border-outline-variant bg-primary-container">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Left Section - Organization Logo */}
          <div className="flex items-center">
            <OrganizationLogo organization={organizationContext.organization} />
          </div>

          {/* Center Section - Quick Links */}
          <div className="hidden md:flex items-center gap-1">
            <Button variant="ghost" size="sm" asChild className="text-on-primary-container hover:bg-surface-variant">
              <Link href="/issues" className="flex items-center gap-2">
                <AlertTriangleIcon className="h-4 w-4" />
                Issues
              </Link>
            </Button>

            <Button variant="default" size="sm" asChild>
              <Link href="/issues/create" className="flex items-center gap-2">
                <PlusIcon className="h-4 w-4" />
                Report Issue
              </Link>
            </Button>

            <Button variant="ghost" size="sm" asChild className="text-on-primary-container hover:bg-surface-variant">
              <Link href="/machines" className="flex items-center gap-2">
                <WrenchIcon className="h-4 w-4" />
                Machines
              </Link>
            </Button>

            <Button variant="ghost" size="sm" asChild className="text-on-primary-container hover:bg-surface-variant">
              <Link href="/locations" className="flex items-center gap-2">
                <MapPinIcon className="h-4 w-4" />
                Locations
              </Link>
            </Button>

            <Button variant="ghost" size="sm" asChild className="text-on-primary-container hover:bg-surface-variant">
              <Link href="/settings" className="flex items-center gap-2">
                <ShieldIcon className="h-4 w-4" />
                Admin
              </Link>
            </Button>
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

          {/* Right Section - User Context */}
          <div className="flex items-center gap-3">
            <NotificationBellWrapper userId={organizationContext.user.id} />
            
            <UserContextDisplay user={organizationContext.user} organization={organizationContext.organization} />

            <UserMenuClient user={organizationContext.user} />
          </div>
        </div>
      </div>
    </nav>
  );
}

// Organization Logo Component (now receives data as props)
function OrganizationLogo({ organization }: { organization: { id: string; name: string; subdomain: string } }) {
  return (
    <Link href="/dashboard" className="flex items-center gap-3">
      <span className="text-xl font-bold text-on-primary-container">
        {organization.name}
      </span>
    </Link>
  );
}

// User Context Display Component (now receives data as props)
function UserContextDisplay({ 
  user, 
  organization 
}: { 
  user: { id: string; name?: string; email: string };
  organization: { id: string; name: string; subdomain: string };
}) {
  return (
    <div className="text-right hidden lg:block">
      <p className="text-sm font-medium text-on-primary-container">{user.name || user.email}</p>
      <p className="text-xs text-on-surface-variant">
        {organization.name}
      </p>
    </div>
  );
}

