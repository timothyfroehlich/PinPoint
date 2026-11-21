"use client";

import type React from "react";
import { Pencil } from "lucide-react";
import { PageActions } from "~/components/list-view/PageActions";

/**
 * The own profile's only page action, Edit profile, which opens the editor
 * by link (design-bible §26).
 */
export function ProfileActions({
  editHref,
  className,
}: {
  editHref: string;
  className?: string | undefined;
}): React.JSX.Element {
  return (
    <PageActions
      actions={[
        {
          key: "edit-profile",
          label: "Edit profile",
          icon: Pencil,
          href: editHref,
        },
      ]}
      menu={[]}
      foldSteps={[]}
      className={className}
    />
  );
}
