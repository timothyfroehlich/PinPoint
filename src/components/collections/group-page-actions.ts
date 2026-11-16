import { Printer } from "lucide-react";
import type { PageAction } from "~/components/list-view";

/**
 * Print, the menu every Machine Group page shows: Settings sheets only, no
 * apron cards entry (collections-and-tags 4.16).
 */
export function groupPrintAction(settingsSheetsHref: string): PageAction {
  return {
    key: "print",
    label: "Print",
    icon: Printer,
    entries: [
      {
        key: "settings-sheets",
        label: "Settings sheets",
        href: settingsSheetsHref,
      },
    ],
    // Folded into ⋯, the entry says what it prints.
    foldedEntries: [
      {
        key: "settings-sheets",
        label: "Print settings sheets",
        href: settingsSheetsHref,
      },
    ],
  };
}

/** Share and Print fold into ⋯ together (collections-and-tags 4.18). */
export const GROUP_FOLD_STEPS: readonly (readonly string[])[] = [
  ["share", "print"],
];
