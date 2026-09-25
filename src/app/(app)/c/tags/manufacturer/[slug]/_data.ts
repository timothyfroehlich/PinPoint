import { cache } from "react";
import { getManufacturerTag } from "~/lib/tags/manufacturer";

/**
 * Request-deduped tag fetch shared by the (tabs) layout and tab pages. Next
 * hands `params` over already decoded, so the segment is compared as is.
 */
export const getManufacturerTagForLayout = cache(async (slug: string) =>
  getManufacturerTag(undefined, slug)
);
