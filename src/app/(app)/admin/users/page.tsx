import { createClient } from "~/lib/supabase/server";
import type React from "react";
import { db } from "~/server/db";
import { userProfiles, authUsers } from "~/server/db/schema";
import { eq, asc } from "drizzle-orm";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { UserRoleSelect } from "./user-role-select";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";

export default async function AdminUsersPage(): Promise<React.JSX.Element | null> {
  const supabase = await createClient();
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  if (!currentUser) {
    return null; // Layout handles redirect
  }

  // Fetch users with emails by joining userProfiles and auth.users
  const users = await db
    .select({
      id: userProfiles.id,
      name: userProfiles.name,
      role: userProfiles.role,
      email: authUsers.email,
      avatarUrl: userProfiles.avatarUrl,
    })
    .from(userProfiles)
    .leftJoin(authUsers, eq(userProfiles.id, authUsers.id))
    .orderBy(asc(userProfiles.name));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">User Management</h2>
        <p className="text-muted-foreground">Manage users and their roles.</p>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage
                      src={user.avatarUrl ?? undefined}
                      alt={user.name}
                    />
                    <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{user.name}</span>
                </TableCell>
                <TableCell>{user.email ?? "N/A"}</TableCell>
                <TableCell>
                  <UserRoleSelect
                    userId={user.id}
                    currentRole={user.role}
                    currentUserId={currentUser.id}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
