import { cache } from "react";
import { getOwnerCollection } from "~/lib/collections/owner";

/**
 * Request-deduped collection fetch shared by the (tabs) layout and tab pages
 * (same pattern as getMachineForLayout in /m/[initials]/_data.ts).
 */
export const getOwnerCollectionForLayout = cache(async (userId: string) =>
  getOwnerCollection(undefined, userId)
);
