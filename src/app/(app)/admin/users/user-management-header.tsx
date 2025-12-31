"use client";

import * as React from "react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { UserPlus } from "lucide-react";
import { InviteUserDialog } from "~/components/users/InviteUserDialog";

export function UserManagementHeader(): React.JSX.Element {
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">User Management</h2>
        <p className="text-muted-foreground">
          Manage activated and unconfirmed users.
        </p>
      </div>
      <Button onClick={() => setInviteDialogOpen(true)}>
        <UserPlus className="mr-2 size-4" />
        Invite User
      </Button>
      <InviteUserDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
      />
    </div>
  );
}
