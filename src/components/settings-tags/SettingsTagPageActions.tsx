"use client";

import type React from "react";
import { useState } from "react";
import { Printer } from "lucide-react";

import {
  PageActions,
  useReturnFocus,
  type PageMenuEntry,
} from "~/components/list-view";
import {
  TagDeleteDialog,
  TagRenameDialog,
} from "~/components/tags/TagManageDialogs";
import {
  SETTINGS_TAGS_HREF,
  setsOnMachinesPhrase,
} from "~/lib/machines/settings-tags";
import {
  deleteSettingsTagAction,
  renameSettingsTagAction,
} from "~/app/(app)/c/settings-tags/actions";

interface SettingsTagPageActionsProps {
  /** Print settings sheets with the tag's machines and starting set (settings-sheets §2.6). */
  printHref: string;
  /**
   * Rename and Delete, for people who manage settings tags (machine-settings
   * §3.3); null for House and Tournament (§3.2) and for everyone else.
   */
  manage: {
    tagId: string;
    name: string;
    setCount: number;
    machineCount: number;
  } | null;
}

type SettingsTagDialog = "rename" | "delete";

/**
 * A settings tag page's actions (design-bible §26): ⋯ holding Rename for
 * managers, Print settings sheets for everyone, and Delete for managers.
 * Print settings sheets alone shows as its own button (list-views §3.7).
 */
export function SettingsTagPageActions({
  printHref,
  manage,
}: SettingsTagPageActionsProps): React.JSX.Element {
  const [dialog, setDialog] = useState<SettingsTagDialog | null>(null);
  const returnFocus = useReturnFocus();
  const dialogProps = (
    which: SettingsTagDialog
  ): {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCloseAutoFocus: (event: Event) => void;
  } => ({
    open: dialog === which,
    onOpenChange: (open) => setDialog(open ? which : null),
    onCloseAutoFocus: returnFocus.onCloseAutoFocus,
  });

  const print: PageMenuEntry = {
    key: "settings-sheets",
    label: "Print settings sheets",
    icon: Printer,
    href: printHref,
  };
  const menu: PageMenuEntry[][] = manage
    ? [
        [
          {
            key: "rename",
            label: "Rename…",
            onSelect: returnFocus.opens(() => setDialog("rename")),
          },
        ],
        [print],
        [
          {
            key: "delete",
            label: "Delete tag",
            destructive: true,
            onSelect: returnFocus.opens(() => setDialog("delete")),
          },
        ],
      ]
    : [[print]];

  const removes =
    manage === null
      ? ""
      : manage.setCount === 0
        ? "No sets carry this tag."
        : `Removes the tag from ${setsOnMachinesPhrase(manage.setCount, manage.machineCount)}. The sets themselves stay.`;

  return (
    <>
      <PageActions actions={[]} menu={menu} foldSteps={[]} />
      {manage ? (
        <>
          <TagRenameDialog
            {...dialogProps("rename")}
            title="Rename tag"
            currentName={manage.name}
            onRename={(next) =>
              renameSettingsTagAction({ tagId: manage.tagId, name: next })
            }
          />
          <TagDeleteDialog
            {...dialogProps("delete")}
            title={`Delete “${manage.name}”?`}
            description={`${removes} This can't be undone.`}
            confirmLabel="Delete tag"
            onDelete={() => deleteSettingsTagAction({ tagId: manage.tagId })}
            redirectTo={SETTINGS_TAGS_HREF}
          />
        </>
      ) : null}
    </>
  );
}
