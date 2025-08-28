import { Suspense } from "react";
import Link from "next/link";
import type { ServerAuthContext } from "~/lib/auth/server-auth";
import { UserMenuClient } from "./client/UserMenuClient";
import { MobileNavToggle } from "./client/MobileNavToggle";
import { NavigationSkeleton } from "./NavigationSkeleton";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";

interface NavItem {
  label: string;
  href: string;
  icon: string; // Lucide icon name
  permissions?: string[];
}

const navigationItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
  { label: "Issues", href: "/issues", icon: "AlertCircle" },
  { label: "Machines", href: "/machines", icon: "Cpu" },
  { label: "Locations", href: "/locations", icon: "MapPin" },
  { label: "Reports", href: "/reports", icon: "BarChart3" },
  { label: "Settings", href: "/settings", icon: "Settings" },
];

interface NavigationContentProps {
  authContext: ServerAuthContext | null;
}

function NavigationContent({ authContext }: NavigationContentProps) {
  const auth = authContext;

  if (!auth) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <Card>
          <CardContent className="pt-6">
            <Button asChild>
              <Link href="/auth/sign-in">Sign In</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Organization Header */}
      <div className="p-4 border-b bg-muted/10">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold truncate">PinPoint</h2>
            <p className="text-sm text-muted-foreground truncate">
              {auth.user.name}
            </p>
          </div>

          {/* Mobile menu toggle */}
          <div className="md:hidden">
            <MobileNavToggle />
          </div>
        </div>
      </div>

      <Separator />

      {/* Navigation Links */}
      <nav className="flex-1 px-4 py-6 space-y-1">
        {navigationItems.map((item) => (
          <NavigationLink key={item.href} item={item} />
        ))}
      </nav>

      <Separator />

      {/* User Menu */}
      <div className="p-4">
        <UserMenuClient user={auth.user} />
      </div>
    </div>
  );
}

function NavigationLink({ item }: { item: NavItem }) {
  return (
    <Button variant="ghost" className="w-full justify-start h-10" asChild>
      <Link href={item.href}>
        {/* Icon would be rendered here based on item.icon */}
        <span className="ml-3">{item.label}</span>
      </Link>
    </Button>
  );
}

interface ServerNavigationProps {
  authContext?: ServerAuthContext | null;
}

export function ServerNavigation({
  authContext = null,
}: ServerNavigationProps) {
  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-white border-r">
      <Suspense fallback={<NavigationSkeleton />}>
        <NavigationContent authContext={authContext} />
      </Suspense>
    </aside>
  );
}
