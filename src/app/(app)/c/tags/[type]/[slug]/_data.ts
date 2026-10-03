import { cache } from "react";
import { getPickerMachines } from "~/app/(app)/c/[id]/_data";
import { getViewer } from "~/lib/collections/viewer";
import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";
import { resolveTag, type ResolvedTag } from "~/lib/tags/tags";
import { db } from "~/server/db";

/**
 * Next passes a dynamic segment through percent-encoded for reserved and
 * non-ASCII characters ("A&B" arrives as `a%26b`), so decode it before
 * comparing it with the generated slug. A malformed escape matches nothing.
 */
function decodeSegment(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

/**
 * Request-deduped tag fetch shared by the (tabs) layout and tab pages. A
 * hand-applied tag resolves by slug whatever the type segment says, so each
 * page compares `tag.href` with its own address and redirects (see
 * {@link canonicalTagPath}).
 */
export const getTagForLayout = cache(
  async (type: string, slug: string): Promise<ResolvedTag | null> => {
    const decodedType = decodeSegment(type);
    const decodedSlug = decodeSegment(slug);
    if (decodedType === null || decodedSlug === null) return null;
    return resolveTag(db, decodedType, decodedSlug);
  }
);

/**
 * The address to redirect to when a hand-applied tag was reached under the
 * wrong type segment (its tag type changed, or a hand-typed URL), or null when
 * the request is already canonical. `suffix` is the tab's own path, such as
 * `/issues`; the query string is kept.
 */
export function canonicalTagPath(
  resolved: ResolvedTag,
  type: string,
  suffix: string,
  searchParams: Record<string, string | string[] | undefined> = {}
): string | null {
  const typeSegment = resolved.tag.href.split("/")[3];
  if (typeSegment === undefined || decodeSegment(type) === typeSegment) {
    return null;
  }
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== undefined) query.append(key, item);
    }
  }
  const qs = query.toString();
  return `${resolved.tag.href}${suffix}${qs ? `?${qs}` : ""}`;
}

/** What the Edit machines dialog and the tag's ⋯ menu need (spec 11.11). */
export interface TagEditor {
  tagId: string;
  tagName: string;
  context: string | null;
  allMachines: { id: string; initials: string; name: string }[];
  currentIds: string[];
  otherTagByMachine: Record<string, string>;
  /** Where to land after deleting the tag. */
  parentHref: string;
}

/**
 * The editing props for a hand-applied tag's page when the viewer may manage
 * tags, else null. Automatic tags are never edited (spec 8.6, 9.6).
 */
export const getTagEditor = cache(
  async (type: string, slug: string): Promise<TagEditor | null> => {
    const resolved = await getTagForLayout(type, slug);
    if (resolved?.tag.kind !== "hand" || resolved.group.kind === "automatic") {
      return null;
    }
    const viewer = await getViewer();
    if (!checkPermission("tags.manage", getAccessLevel(viewer.role))) {
      return null;
    }
    const { tag, group } = resolved;
    // In an exclusive type, adding a machine moves it off its other tag.
    const otherTagByMachine: Record<string, string> = {};
    if (group.kind === "hand" && group.type.exclusive) {
      for (const sibling of group.tags) {
        if (sibling.id === tag.id) continue;
        for (const machine of sibling.machines) {
          otherTagByMachine[machine.id] = sibling.name;
        }
      }
    }
    return {
      tagId: tag.id,
      tagName: tag.name,
      context:
        group.kind === "hand"
          ? group.type.exclusive
            ? `${group.type.name} · One per machine`
            : group.type.name
          : null,
      allMachines: await getPickerMachines(),
      currentIds: tag.machines.map((machine) => machine.id),
      otherTagByMachine,
      parentHref: group.kind === "hand" ? group.type.href : "/c/tags",
    };
  }
);
