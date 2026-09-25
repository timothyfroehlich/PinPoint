import { cache } from "react";
import { getManufacturerTag } from "~/lib/tags/manufacturer";

/**
 * Next passes a dynamic segment through percent-encoded for reserved and
 * non-ASCII characters ("A&B" arrives as `a%26b`), so decode it before
 * comparing it with the generated slug. A malformed escape matches nothing.
 */
function decodeSlug(slug: string): string | null {
  try {
    return decodeURIComponent(slug);
  } catch {
    return null;
  }
}

/** Request-deduped tag fetch shared by the (tabs) layout and tab pages. */
export const getManufacturerTagForLayout = cache(async (slug: string) => {
  const decoded = decodeSlug(slug);
  return decoded === null ? null : getManufacturerTag(undefined, decoded);
});
