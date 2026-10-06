import { revalidatePath } from "next/cache";

/**
 * Revalidate a machine's page and, for each entry in `tabs`, the page under it
 * (`"timeline"`, `"settings"`, `` `i/${issueNumber}` ``).
 */
export function revalidateMachine(
  initials: string,
  tabs: readonly string[] = []
): void {
  revalidatePath(`/m/${initials}`);
  for (const tab of tabs) {
    revalidatePath(`/m/${initials}/${tab}`);
  }
}
