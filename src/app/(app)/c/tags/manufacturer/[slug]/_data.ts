import { cache } from "react";
import { getManufacturerTag } from "~/lib/tags/manufacturer";

function decodeSlug(slug: string): string {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

/**
 * Request-deduped tag fetch shared by the (tabs) layout and tab pages. The
 * segment is decoded defensively so a percent-encoded name still resolves.
 */
export const getManufacturerTagForLayout = cache(async (slug: string) =>
  getManufacturerTag(undefined, decodeSlug(slug))
);
