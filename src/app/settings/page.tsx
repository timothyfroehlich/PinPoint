/**
 * Settings Overview Page
 * Server Component displaying settings dashboard and quick actions
 * Phase 4B: Essential Administrative Interfaces
 */

import React from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import {
  BuildingIcon,
  UsersIcon,
  SettingsIcon,
  ActivityIcon,
  ShieldIcon,
  ArrowRightIcon,
} from "lucide-react";
import { getRequestAuthContext } from "~/server/auth/context";
import { getCurrentOrganization } from "~/lib/dal/organizations";
import { AuthGuard } from "~/components/auth/auth-guard";

export default async function SettingsPage(): Promise<React.JSX.Element> {
  const authContext = await getRequestAuthContext();

  return (
    <AuthGuard
      authContext={authContext}
      fallbackTitle="Settings Access Required"
      fallbackMessage="You need to be signed in as a member to view settings."
    >
      <SettingsPageContent />
    </AuthGuard>
  );
}

async function SettingsPageContent(): Promise<React.JSX.Element> {
  const authContext = await getRequestAuthContext();
  if (authContext.kind !== "authorized") {
    throw new Error("Unauthorized access"); // This should never happen due to AuthGuard
  }
  const { user } = authContext;
  const orgDetails = await getCurrentOrganization(authContext.org.id);

  const settingsCards = [
    {
      title: "Organization",
      description: "Manage organization profile, logo, and basic settings",
      href: "/settings/organization",
      icon: BuildingIcon,
      stats: orgDetails.name,
    },
    {
      title: "Users & Roles",
      description: "Manage team members, roles, and permissions",
      href: "/settings/users",
      icon: UsersIcon,
      stats: "View team",
    },
    {
      title: "Role Management",
      description: "Configure roles and permission templates",
      href: "/settings/roles",
      icon: ShieldIcon,
      stats: "Manage roles",
    },
    {
      title: "System Settings",
      description: "Application preferences and configuration options",
      href: "/settings/system",
      icon: SettingsIcon,
      stats: "Configure app",
    },
    {
      title: "Activity Log",
      description: "View audit trail and system events for compliance",
      href: "/settings/activity",
      icon: ActivityIcon,
      stats: "View history",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your organization settings and administrative preferences
        </p>
      </div>

      {/* Quick Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Organization Overview</CardTitle>
          <CardDescription>
            Current organization and user information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-2xl font-bold">{orgDetails.name}</div>
              <p className="text-xs text-muted-foreground">Organization Name</p>
            </div>
            <div>
              <div className="text-2xl font-bold">{user.email}</div>
              <p className="text-xs text-muted-foreground">Your Account</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Settings Cards Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {settingsCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.href} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  <div className="flex items-center space-x-2">
                    <Icon className="h-4 w-4" />
                    <span>{card.title}</span>
                  </div>
                </CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={card.href}>
                    <ArrowRightIcon className="h-4 w-4" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground mb-3">
                  {card.description}
                </div>
                <div className="text-2xl font-bold">{card.stats}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common administrative tasks and shortcuts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/settings/users">
                <UsersIcon className="mr-2 h-4 w-4" />
                Manage Users
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/settings/organization">
                <BuildingIcon className="mr-2 h-4 w-4" />
                Edit Organization
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/settings/activity">
                <ActivityIcon className="mr-2 h-4 w-4" />
                View Activity
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
