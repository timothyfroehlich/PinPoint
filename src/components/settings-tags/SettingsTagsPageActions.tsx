"use client";

import type React from "react";
import { useState } from "react";
import { Plus } from "lucide-react";
import { PageActions, useReturnFocus } from "~/components/list-view";
import { NewSettingsTagDialog } from "~/components/settings-tags/NewSettingsTagDialog";

/**
 * The Settings tags page's actions, for people who manage settings tags
 * (machine-settings §3.3): New settings tag, the page's create action
 * (design-bible §26).
 */
export function SettingsTagsPageActions(): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const returnFocus = useReturnFocus();
  return (
    <>
      <PageActions
        actions={[
          {
            key: "new-settings-tag",
            label: "New settings tag",
            icon: Plus,
            primary: true,
            onSelect: returnFocus.opens(() => setOpen(true)),
          },
        ]}
        menu={[]}
        foldSteps={[["new-settings-tag"]]}
      />
      <NewSettingsTagDialog
        open={open}
        onOpenChange={setOpen}
        onCloseAutoFocus={returnFocus.onCloseAutoFocus}
      />
    </>
  );
}
