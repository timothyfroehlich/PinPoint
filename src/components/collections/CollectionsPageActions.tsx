"use client";

import type React from "react";
import { useState } from "react";
import { Plus } from "lucide-react";
import { CreateCollectionDialog } from "~/components/collections/CreateCollectionDialog";
import { PageActions, useReturnFocus } from "~/components/list-view";

interface CollectionsPageActionsProps {
  /** The machines New collection can start with. */
  allMachines: { id: string; initials: string; name: string }[];
}

/**
 * My Collections' actions: New collection, the page's create action
 * (design-bible §26).
 */
export function CollectionsPageActions({
  allMachines,
}: CollectionsPageActionsProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const returnFocus = useReturnFocus();
  return (
    <>
      <PageActions
        actions={[
          {
            key: "new-collection",
            label: "New collection",
            icon: Plus,
            primary: true,
            onSelect: returnFocus.opens(() => setOpen(true)),
            testId: "create-collection-trigger",
          },
        ]}
        menu={[]}
        foldSteps={[["new-collection"]]}
      />
      <CreateCollectionDialog
        open={open}
        onOpenChange={setOpen}
        onCloseAutoFocus={returnFocus.onCloseAutoFocus}
        allMachines={allMachines}
      />
    </>
  );
}
