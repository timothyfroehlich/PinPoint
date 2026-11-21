import { Printer } from "lucide-react";
import type { PageMenuEntry } from "~/components/list-view";

/**
 * Print settings sheets, the ⋯ entry every Machine Group page holds for
 * everyone; there is no apron cards entry (collections-and-tags 4.16). Its
 * icon lets it show as its own button when it is ⋯'s only entry
 * (list-views §3.7).
 */
export function groupPrintEntry(settingsSheetsHref: string): PageMenuEntry {
  return {
    key: "settings-sheets",
    label: "Print settings sheets",
    icon: Printer,
    href: settingsSheetsHref,
  };
}

/** Share is the only action that folds (collections-and-tags 4.18). */
export const GROUP_FOLD_STEPS: readonly (readonly string[])[] = [["share"]];
