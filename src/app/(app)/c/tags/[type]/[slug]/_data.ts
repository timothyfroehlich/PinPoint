import { cache } from "react";
import { getTag } from "~/lib/tags/tags";
import { isTagTypeId } from "~/lib/tags/types";
import { db } from "~/server/db";

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
export const getTagForLayout = cache(async (type: string, slug: string) => {
  const decoded = decodeSlug(slug);
  if (decoded === null || !isTagTypeId(type)) return null;
  return getTag(db, type, decoded);
});
