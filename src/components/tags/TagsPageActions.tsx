"use client";

import type React from "react";
import { useState } from "react";
import { FolderPlus, Plus, Tag } from "lucide-react";
import {
  PageActions,
  useReturnFocus,
  type PageAction,
} from "~/components/list-view";
import { AddTagDialog } from "~/components/tags/AddTagDialog";
import { AddTagTypeDialog } from "~/components/tags/AddTagTypeDialog";
import { SETTINGS_TAGS_HREF } from "~/lib/machines/settings-tags";

interface TagsPageActionsProps {
  /**
   * The hand-applied tag types Add tag offers, for technicians and admins
   * (spec 11.12); null for everyone else.
   */
  manage: { types: { id: string; name: string }[] } | null;
}

type TagsDialog = "add-tag" | "add-tag-type";

/**
 * The Tags page's actions (spec 11.12–11.14; design-bible §26): the
 * Settings tags link, Add tag as the create action, and ⋯ holding Add tag
 * type. Settings tags folds first and Add tag last.
 */
export function TagsPageActions({
  manage,
}: TagsPageActionsProps): React.JSX.Element {
  const [dialog, setDialog] = useState<TagsDialog | null>(null);
  const returnFocus = useReturnFocus();
  const dialogProps = (
    which: TagsDialog
  ): {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCloseAutoFocus: (event: Event) => void;
  } => ({
    open: dialog === which,
    onOpenChange: (open) => setDialog(open ? which : null),
    onCloseAutoFocus: returnFocus.onCloseAutoFocus,
  });

  // Settings tags label settings sets, not machines (machine-settings §3.7).
  const actions: PageAction[] = [
    {
      key: "settings-tags",
      label: "Settings tags",
      icon: Tag,
      href: SETTINGS_TAGS_HREF,
    },
  ];
  if (manage) {
    actions.push({
      key: "add-tag",
      label: "Add tag",
      icon: Plus,
      primary: true,
      onSelect: returnFocus.opens(() => setDialog("add-tag")),
    });
  }

  return (
    <>
      <PageActions
        actions={actions}
        menu={
          manage
            ? [
                [
                  {
                    key: "add-tag-type",
                    label: "Add tag type…",
                    icon: FolderPlus,
                    buttonLabel: "Add tag type",
                    onSelect: returnFocus.opens(() =>
                      setDialog("add-tag-type")
                    ),
                  },
                ],
              ]
            : []
        }
        foldSteps={[["settings-tags"], ["add-tag"]]}
      />
      {manage ? (
        <>
          <AddTagDialog {...dialogProps("add-tag")} types={manage.types} />
          <AddTagTypeDialog {...dialogProps("add-tag-type")} />
        </>
      ) : null}
    </>
  );
}
