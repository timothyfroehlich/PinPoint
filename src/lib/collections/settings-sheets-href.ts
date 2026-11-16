import type { CollectionMachine } from "~/lib/collections/types";

/**
 * Print settings sheets with a Machine Group's machines On the Floor already
 * added (settings-sheets §2.6, collections-and-tags 4.16).
 */
export function groupSettingsSheetsHref(
  machines: readonly Pick<CollectionMachine, "initials" | "presenceStatus">[]
): string {
  const initials = machines
    .filter((machine) => machine.presenceStatus === "on_the_floor")
    .map((machine) => machine.initials);
  const params = new URLSearchParams({ m: initials.join(",") });
  return `/m/settings-sheets?${params.toString()}`;
}
