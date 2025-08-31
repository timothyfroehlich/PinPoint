/**
 * Settings Layout - Administrative Interface
 * Server Component with navigation tabs and permission checks
 * Phase 4B: Essential Administrative Interfaces
 */

import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import {
  BuildingIcon,
  UsersIcon,
  SettingsIcon,
  ActivityIcon,
  ShieldIcon,
} from "lucide-react";
import { requireMemberAccess } from "~/lib/organization-context";

interface SettingsLayoutProps {
  children: React.ReactNode;
}

export default async function SettingsLayout({ children }: SettingsLayoutProps) {
  // Ensure user is authenticated and has organization access
  await requireMemberAccess();
  
  // requireMemberAccess already ensures user is authenticated and has membership
  // No additional checks needed

  const navigationItems = [
    {
      title: "Organization",
      href: "/settings/organization",
      icon: BuildingIcon,
      description: "Manage organization profile and settings",
    },
    {
      title: "Users",
      href: "/settings/users", 
      icon: UsersIcon,
      description: "Manage team members and permissions",
    },
    {
      title: "Roles",
      href: "/settings/roles",
      icon: ShieldIcon, 
      description: "Configure roles and permissions",
    },
    {
      title: "System",
      href: "/settings/system",
      icon: SettingsIcon,
      description: "Application preferences and configuration",
    },
    {
      title: "Activity",
      href: "/settings/activity",
      icon: ActivityIcon,
      description: "View audit trail and system events",
    },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
        {/* Settings Navigation Sidebar */}
        <aside className="lg:w-1/5">
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Settings</h2>
              <p className="text-sm text-muted-foreground">
                Manage your organization and application settings
              </p>
            </div>
            
            <Separator />
            
            <nav className="space-y-2">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Button
                    key={item.href}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    asChild
                  >
                    <Link href={item.href}>
                      <Icon className="mr-2 h-4 w-4" />
                      {item.title}
                    </Link>
                  </Button>
                );
              })}
            </nav>
          </div>
        </aside>
        
        {/* Settings Content */}
        <div className="flex-1 lg:max-w-4xl">
          <div className="space-y-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}