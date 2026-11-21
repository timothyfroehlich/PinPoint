"use client";

import type React from "react";
import { useState } from "react";
import { UserPlus } from "lucide-react";
import { PageActions, useReturnFocus } from "~/components/list-view";
import { InviteUserDialog } from "~/components/users/InviteUserDialog";

/**
 * User Management's actions: Invite User, the page's create action
 * (design-bible §26).
 */
export function InviteUserButton(): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const returnFocus = useReturnFocus();

  return (
    <>
      <PageActions
        actions={[
          {
            key: "invite-user",
            label: "Invite User",
            icon: UserPlus,
            primary: true,
            onSelect: returnFocus.opens(() => setOpen(true)),
          },
        ]}
        menu={[]}
        foldSteps={[["invite-user"]]}
      />
      <InviteUserDialog
        open={open}
        onOpenChange={setOpen}
        onCloseAutoFocus={returnFocus.onCloseAutoFocus}
      />
    </>
  );
}
