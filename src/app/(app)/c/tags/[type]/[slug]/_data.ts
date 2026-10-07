import { cache } from "react";
import { getViewer } from "~/lib/auth/viewer";
import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";
import {
  mergeConflicts,
  moveConflicts,
  typesWithTagName,
} from "~/lib/tags/conflicts";
import {
  getTagPickerMachines,
  listTags,
  resolveTag,
  type ResolvedTag,
} from "~/lib/tags/tags";
import { isRemoved } from "~/lib/machines/presence";
import type { TagConflictMachine } from "~/lib/tags/types";
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
 * hand-applied tag resolves by slug whatever the type segment says, and a
 * merged tag's slug resolves to its target, so each page compares `tag.href`
 * with its own address and redirects (see {@link canonicalTagPath}).
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
 * The address to redirect to when a hand-applied tag was reached by an address
 * other than its own: under the wrong type segment (its tag type changed, or a
 * hand-typed URL) or by the slug of a tag merged into it (spec 11.19). Null
 * when the request is already canonical. `suffix` is the tab's own path, such
 * as `/issues`; the query string is kept.
 */
export function canonicalTagPath(
  resolved: ResolvedTag,
  requested: { type: string; slug: string },
  suffix: string,
  searchParams: Record<string, string | string[] | undefined> = {}
): string | null {
  const [, , , typeSegment, slugSegment] = resolved.tag.href.split("/");
  if (typeSegment === undefined || slugSegment === undefined) return null;
  if (
    decodeSegment(requested.type) === typeSegment &&
    decodeSegment(requested.slug) === decodeSegment(slugSegment)
  ) {
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
    if (resolved?.tag.kind !== "hand") {
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
      allMachines: await getTagPickerMachines(tag.id),
      currentIds: tag.machines.map((machine) => machine.id),
      otherTagByMachine,
      parentHref: group.kind === "hand" ? group.type.href : "/c/tags",
    };
  }
);

/**
 * The machines holding a tag that hold other tags, by tag type: what blocks
 * moving it (11.16) or merging it (11.18). Both dialogs read it, so it is
 * request-deduped.
 */
const getMoveConflicts = cache(
  (tagId: string): Promise<Map<string, TagConflictMachine[]>> =>
    moveConflicts(db, tagId)
);

/** One place a hand-applied tag can move to (spec 11.16). */
export interface TagMoveDestination {
  /** A hand-applied tag type's id, or null for no tag type. */
  id: string | null;
  /** The tag type's name; unused for no tag type. */
  name: string;
  exclusive: boolean;
  /** Another tag there already has this tag's name. */
  nameTaken: boolean;
  /** In an exclusive type: machines that would hold two of its tags. */
  conflicts: TagConflictMachine[];
}

/** What the tag's Move dialog needs, so it can validate as a type is picked. */
export interface TagMove {
  tagId: string;
  tagName: string;
  /** The tag's tag type, or null when it has none. */
  typeId: string | null;
  typeName: string | null;
  machineCount: number;
  /** No tag type first, then each hand-applied tag type by name (11.14). */
  destinations: TagMoveDestination[];
}

/**
 * The Move dialog's props for a hand-applied tag's page when the viewer may
 * manage tags, else null. The action checks all of this again (11.16).
 */
export const getTagMove = cache(
  async (type: string, slug: string): Promise<TagMove | null> => {
    const resolved = await getTagForLayout(type, slug);
    if (resolved?.tag.kind !== "hand") return null;
    const viewer = await getViewer();
    if (!checkPermission("tags.manage", getAccessLevel(viewer.role))) {
      return null;
    }
    const { tag, group } = resolved;
    const [groups, taken, conflicts] = await Promise.all([
      listTags(),
      typesWithTagName(db, tag.id),
      getMoveConflicts(tag.id),
    ]);
    const destinations: TagMoveDestination[] = [
      {
        id: null,
        name: "",
        exclusive: false,
        nameTaken: taken.has(null),
        conflicts: [],
      },
      ...groups.flatMap((candidate): TagMoveDestination[] =>
        candidate.kind === "hand"
          ? [
              {
                id: candidate.type.id,
                name: candidate.type.name,
                exclusive: candidate.type.exclusive,
                nameTaken: taken.has(candidate.type.id),
                conflicts: candidate.type.exclusive
                  ? (conflicts.get(candidate.type.id) ?? [])
                  : [],
              },
            ]
          : []
      ),
    ];
    return {
      tagId: tag.id,
      tagName: tag.name,
      typeId: tag.typeId,
      typeName: group.kind === "hand" ? group.type.name : null,
      machineCount: tag.machineCount,
      destinations,
    };
  }
);

/** One tag a hand-applied tag can be merged into (spec 11.17). */
export interface TagMergeTarget {
  id: string;
  name: string;
  /** Machines other than Removed ones, as the tag shows (spec 7.9). */
  machineCount: number;
  /** Of the merged tag's counted machines, how many already hold this one. */
  alreadyCount: number;
  /** In an exclusive type: machines that would hold two of its tags (11.18). */
  conflicts: TagConflictMachine[];
}

/** The merge targets in one tag type, or the tags with no tag type. */
export interface TagMergeGroup {
  /** The tag type's name, or null for the tags with no tag type. */
  typeName: string | null;
  exclusive: boolean;
  targets: TagMergeTarget[];
}

/** What the tag's Merge dialog needs, so it can validate as a tag is picked. */
export interface TagMerge {
  tagId: string;
  tagName: string;
  /** The tag's tag type, or null when it has none. */
  typeName: string | null;
  machineCount: number;
  /** Every other hand-applied tag, grouped in browse order (11.14). */
  groups: TagMergeGroup[];
}

/**
 * The Merge dialog's props for a hand-applied tag's page when the viewer may
 * manage tags, else null. The action checks the conflicts again (11.18).
 */
export const getTagMerge = cache(
  async (type: string, slug: string): Promise<TagMerge | null> => {
    const resolved = await getTagForLayout(type, slug);
    if (resolved?.tag.kind !== "hand") return null;
    const viewer = await getViewer();
    if (!checkPermission("tags.manage", getAccessLevel(viewer.role))) {
      return null;
    }
    const { tag, group } = resolved;
    const [groups, conflicts] = await Promise.all([
      listTags(),
      getMoveConflicts(tag.id),
    ]);
    const counted = new Set(
      tag.machines
        .filter((machine) => !isRemoved(machine.presenceStatus))
        .map((machine) => machine.id)
    );
    return {
      tagId: tag.id,
      tagName: tag.name,
      typeName: group.kind === "hand" ? group.type.name : null,
      machineCount: tag.machineCount,
      groups: groups.flatMap((candidate): TagMergeGroup[] => {
        if (candidate.kind === "automatic") return [];
        const type = candidate.kind === "hand" ? candidate.type : null;
        const targets = candidate.tags
          .filter((target) => target.id !== tag.id)
          .map((target): TagMergeTarget => ({
            id: target.id,
            name: target.name,
            machineCount: target.machineCount,
            alreadyCount: target.machines.filter((machine) =>
              counted.has(machine.id)
            ).length,
            conflicts: type?.exclusive
              ? mergeConflicts(conflicts, {
                  typeId: type.id,
                  name: target.name,
                })
              : [],
          }));
        return targets.length === 0
          ? []
          : [
              {
                typeName: type?.name ?? null,
                exclusive: type?.exclusive ?? false,
                targets,
              },
            ];
      }),
    };
  }
);
