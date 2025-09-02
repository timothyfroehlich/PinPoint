/**
 * User Management Settings Page
 * Server Component with user directory and role management
 * Phase 4B.2: User and Role Management
 */

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
import { UsersIcon, MailIcon, CalendarIcon, ShieldIcon } from "lucide-react";
import { requireMemberAccess } from "~/lib/organization-context";
import { api } from "~/trpc/server";
import { UserTableActions } from "./components/UserTableActions";
import { InviteUserDialog } from "./components/InviteUserDialog";
import { format } from "date-fns";

export default async function UsersSettingsPage() {
  await requireMemberAccess();

  // Fetch organization users and roles using the existing admin router
  const [users, roles] = await Promise.all([
    api.admin.getUsers(),
    api.role.getAll(),
  ]);

  // Group users by role for better organization
  const usersByRole = users.reduce<Record<string, typeof users>>(
    (acc, user) => {
      const roleName = user.role.name;
      acc[roleName] ??= [];
      acc[roleName].push(user);
      return acc;
    },
    {},
  );

  const totalUsers = users.length;

  // Format roles for dialogs
  const availableRoles = roles.map((role) => ({
    id: role.id,
    name: role.name,
    description: (role as any).description ?? undefined,
    isSystem: role.isSystem,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground">
            Manage team members, roles, and permissions for your organization
          </p>
        </div>
        <InviteUserDialog availableRoles={availableRoles} />
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <UsersIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsers}</div>
          </CardContent>
        </Card>

        {Object.entries(usersByRole).map(([roleName, roleUsers]) => (
          <Card key={roleName}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{roleName}s</CardTitle>
              <ShieldIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{roleUsers.length}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>
                All users in your organization with their roles and status
              </CardDescription>
            </div>
            <Button size="sm" asChild>
              <InviteUserDialog availableRoles={availableRoles} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {users.map((user, index) => (
              <div key={user.userId}>
                <div className="flex items-center justify-between py-4">
                  {/* User Info */}
                  <div className="flex items-center space-x-4">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-r from-primary to-primary-container flex items-center justify-center">
                      <span className="text-sm font-medium text-white">
                        {user.name.charAt(0).toUpperCase() ||
                          user.email.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-medium">
                          {user.name || "No name set"}
                        </p>
                        {user.role.isSystem && (
                          <Badge variant="outline" className="text-xs">
                            System
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                        <div className="flex items-center">
                          <MailIcon className="mr-1 h-3 w-3" />
                          {user.email}
                        </div>
                        <div className="flex items-center">
                          <CalendarIcon className="mr-1 h-3 w-3" />
                          Joined {format(new Date(user.createdAt), "MMM yyyy")}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Role and Actions */}
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <Badge variant="secondary">{user.role.name}</Badge>
                      {user.emailVerified ? (
                        <p className="text-xs text-tertiary mt-1">Verified</p>
                      ) : (
                        <p className="text-xs text-secondary mt-1">Pending</p>
                      )}
                    </div>

                    <UserTableActions
                      user={user}
                      currentUserCanManage={true} // TODO: Add proper permission checking
                      availableRoles={availableRoles}
                    />
                  </div>
                </div>

                {index < users.length - 1 && <Separator />}
              </div>
            ))}

            {users.length === 0 && (
              <div className="text-center py-8">
                <UsersIcon className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-medium">No users found</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Get started by inviting your first team member.
                </p>
                <div className="mt-6">
                  <InviteUserDialog availableRoles={availableRoles} />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Role Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Role Distribution</CardTitle>
          <CardDescription>
            Overview of user roles in your organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(usersByRole).map(([roleName, roleUsers]) => (
              <div key={roleName} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ShieldIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{roleName}</span>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-muted-foreground">
                    {roleUsers.length} user{roleUsers.length !== 1 ? "s" : ""}
                  </span>
                  <Button variant="outline" size="sm" asChild>
                    <a href={`/settings/roles`}>Manage Role</a>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
