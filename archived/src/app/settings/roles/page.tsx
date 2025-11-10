/**
 * Role Management Settings Page
 * Server Component with role and permission management
 * Phase 4B.2: User and Role Management
 */

import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import {
  ShieldIcon,
  PlusIcon,
  UsersIcon,
  LockIcon,
  SettingsIcon,
  CheckIcon,
} from "lucide-react";
import { getRequestAuthContext } from "~/server/auth/context";
import { AuthGuard } from "~/components/auth/auth-guard";
import { api } from "~/trpc/server";

// Type definitions for role statistics
interface RoleStatistic {
  id: string;
  _count: {
    members: number;
  };
}

// Type guard for role statistics
function isValidRoleStatistic(value: unknown): value is RoleStatistic {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "_count" in value &&
    typeof (value as RoleStatistic).id === "string" &&
    typeof (value as RoleStatistic)._count === "object" &&
    typeof (value as RoleStatistic)._count.members === "number"
  );
}

// Type guard for role with description
function getRoleDescription(role: { description?: string }): string {
  return role.description ?? "No description provided";
}

// Type guard for checking if role has permissions
function hasPermissions(
  role: unknown,
): role is { permissions: { id: string; name: string }[] } {
  return (
    typeof role === "object" &&
    role !== null &&
    "permissions" in role &&
    Array.isArray((role as { permissions: unknown }).permissions)
  );
}

// Safe permission access function
function getPermissionsArray(role: unknown): { id: string; name: string }[] {
  if (hasPermissions(role)) {
    return role.permissions;
  }
  return [];
}

export default async function RolesSettingsPage(): Promise<React.JSX.Element> {
  const authContext = await getRequestAuthContext();

  return (
    <AuthGuard
      authContext={authContext}
      fallbackTitle="Role Management Access Required"
      fallbackMessage="You need to be signed in as a member to manage roles and permissions."
    >
      <RolesSettingsPageContent />
    </AuthGuard>
  );
}

async function RolesSettingsPageContent(): Promise<React.JSX.Element> {
  const authContext = await getRequestAuthContext();
  if (authContext.kind !== "authorized") {
    throw new Error("Unauthorized access"); // This should never happen due to AuthGuard
  }
  // Fetch roles using the existing role router
  const roles = await api.role.getAll();
  // TODO: Implement role statistics API
  const roleStats: RoleStatistic[] = [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Role Management</h1>
          <p className="text-muted-foreground">
            Configure roles and permissions for your organization
          </p>
        </div>
        <Button>
          <PlusIcon className="mr-2 h-4 w-4" />
          Create Role
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Roles</CardTitle>
            <ShieldIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{roles.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Roles</CardTitle>
            <LockIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {roles.filter((role) => role.isSystem).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Custom Roles</CardTitle>
            <SettingsIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {roles.filter((role) => !role.isSystem).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Users Assigned
            </CardTitle>
            <UsersIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {roleStats.reduce((total, stat) => {
                if (isValidRoleStatistic(stat)) {
                  return total + stat._count.members;
                }
                return total;
              }, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Roles List */}
      <Card>
        <CardHeader>
          <CardTitle>Organization Roles</CardTitle>
          <CardDescription>
            Manage roles and their associated permissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {roles.map((role, index) => (
              <div key={role.id}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="h-10 w-10 rounded-lg bg-gradient-to-r from-primary to-primary-container flex items-center justify-center">
                      <ShieldIcon className="h-5 w-5 text-white" />
                    </div>

                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-lg font-medium">{role.name}</h3>
                        {role.isSystem && (
                          <Badge variant="secondary">System</Badge>
                        )}
                        {role.isDefault && (
                          <Badge variant="outline">Default</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {getRoleDescription(role as { description?: string })}
                      </p>
                      <div className="flex items-center space-x-4 mt-2 text-xs text-muted-foreground">
                        <span>
                          {roleStats.find(
                            (stat) =>
                              isValidRoleStatistic(stat) && stat.id === role.id,
                          )?._count.members ?? 0}{" "}
                          users
                        </span>
                        <span>•</span>
                        <span>
                          {getPermissionsArray(role).length} permissions
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm">
                      Edit Permissions
                    </Button>
                    {!role.isSystem && (
                      <Button variant="ghost" size="sm">
                        <SettingsIcon className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Role Permissions Preview */}
                {getPermissionsArray(role).length > 0 && (
                  <div className="mt-4 ml-14">
                    <h4 className="text-sm font-medium mb-2">Permissions</h4>
                    <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                      {getPermissionsArray(role)
                        .slice(0, 6)
                        .map((permission) => (
                          <div
                            key={permission.id}
                            className="flex items-center space-x-2 text-sm"
                          >
                            <CheckIcon className="h-3 w-3 text-tertiary" />
                            <span>{permission.name}</span>
                          </div>
                        ))}
                      {getPermissionsArray(role).length > 6 && (
                        <div className="text-sm text-muted-foreground">
                          +{getPermissionsArray(role).length - 6} more...
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {index < roles.length - 1 && <Separator className="mt-6" />}
              </div>
            ))}
          </div>

          {roles.length === 0 && (
            <div className="text-center py-8">
              <ShieldIcon className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">No roles found</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Create your first custom role to get started.
              </p>
              <div className="mt-6">
                <Button>
                  <PlusIcon className="mr-2 h-4 w-4" />
                  Create Role
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Permission Templates */}
      <Card>
        <CardHeader>
          <CardTitle>Permission Templates</CardTitle>
          <CardDescription>
            Pre-configured permission sets for common roles
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                name: "Administrator",
                description: "Full access to all features",
                permissions: ["All permissions"],
                color: "from-error to-error-container",
              },
              {
                name: "Manager",
                description: "User management and reporting",
                permissions: ["Manage Users", "View Reports", "Manage Issues"],
                color: "from-primary to-primary-container",
              },
              {
                name: "Member",
                description: "Standard user access",
                permissions: ["Create Issues", "View Machines", "Comment"],
                color: "from-tertiary to-tertiary-container",
              },
            ].map((template) => (
              <Card
                key={template.name}
                className="hover:shadow-md transition-shadow"
              >
                <CardHeader className="pb-3">
                  <div
                    className={`h-8 w-8 rounded-lg bg-gradient-to-r ${template.color} flex items-center justify-center mb-2`}
                  >
                    <ShieldIcon className="h-4 w-4 text-white" />
                  </div>
                  <CardTitle className="text-base">{template.name}</CardTitle>
                  <CardDescription className="text-sm">
                    {template.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-1 mb-4">
                    {template.permissions.map((permission, idx) => (
                      <div
                        key={idx}
                        className="flex items-center text-xs text-muted-foreground"
                      >
                        <CheckIcon className="mr-1 h-3 w-3 text-tertiary" />
                        {permission}
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" size="sm" className="w-full">
                    Use Template
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
