"use client";

import React, { useState } from "react";
import { Button } from "~/components/ui/button";
import { UserPlus } from "lucide-react";
import { InviteUserDialog } from "~/components/users/InviteUserDialog";

export function InviteUserButton(): React.JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserPlus className="mr-2 size-4" />
        Invite User
      </Button>
      <InviteUserDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
