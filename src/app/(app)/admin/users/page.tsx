import { createClient } from "~/lib/supabase/server";
import type React from "react";
import { PageContainer } from "~/components/layout/PageContainer";
import { PageHeader } from "~/components/layout/PageHeader";
import { InviteUserButton } from "./invite-user-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { getUnifiedUsers } from "~/lib/users/queries";
import { UserRoleSelect } from "./user-role-select";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { ResendInviteButton } from "./resend-invite-button";
import { RemoveInvitedUserButton } from "./remove-invited-user-button";
import type { UnifiedUser } from "~/lib/types";
import { formatDate } from "~/lib/dates";

function UserRow({
  user,
  currentUserId,
}: {
  user: UnifiedUser;
  currentUserId: string;
}): React.JSX.Element {
  return (
    <TableRow key={`${user.status}-${user.id}`}>
      <TableCell className="w-[300px]">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src={user.avatarUrl ?? undefined} alt={user.name} />
            <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <span className="truncate font-medium" title={user.name}>
            {user.name}
          </span>
        </div>
      </TableCell>
      <TableCell
        className="max-w-[200px] truncate"
        title={user.email ?? undefined}
      >
        {user.email}
      </TableCell>
      <TableCell className="w-[150px]">
        {user.status === "active" ? (
          <Badge
            variant="outline"
            className="border-success/40 bg-success/15 text-success"
          >
            Active
          </Badge>
        ) : (
          <div className="flex flex-col gap-1">
            <Badge
              variant="outline"
              className="border-warning/40 bg-warning/15 text-warning"
            >
              Invited
            </Badge>
            {user.inviteSentAt && (
              <span className="truncate text-[10px] text-muted-foreground">
                Sent {formatDate(user.inviteSentAt)}
              </span>
            )}
          </div>
        )}
      </TableCell>
      <TableCell>
        <UserRoleSelect
          userId={user.id}
          userName={user.name}
          currentRole={user.role}
          currentUserId={currentUserId}
          userType={user.status}
        />
      </TableCell>
      <TableCell className="text-right">
        {user.status === "invited" && (
          <div className="flex justify-end gap-2">
            <ResendInviteButton userId={user.id} userName={user.name} />
            <RemoveInvitedUserButton userId={user.id} userName={user.name} />
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}

export default async function AdminUsersPage(): Promise<React.JSX.Element> {
  const supabase = await createClient();
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  if (!currentUser) {
    return <></>; // Layout handles redirect
  }

  // Fetch all users (active and invited)
  const users = await getUnifiedUsers({ includeEmails: true });

  return (
    <PageContainer size="standard">
      <PageHeader title="User Management" actions={<InviteUserButton />} />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <UserRow
                key={`${user.status}-${user.id}`}
                user={user}
                currentUserId={currentUser.id}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </PageContainer>
  );
}
