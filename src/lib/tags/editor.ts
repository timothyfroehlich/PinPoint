import { orderHandTags } from "./groups";
import type { TagGroup } from "./types";

/**
 * The machine page's tag editor (spec collections-and-tags 11.4–11.6, 11.10,
 * 11.15). Only hand-applied tags appear in it; automatic tags follow machine
 * data and nobody applies them.
 *
 * The shapes here are the minimum the client component needs (CORE-SEC-006):
 * no machine lists, slugs, or hrefs.
 */

/** One hand-applied tag the editor offers. */
export interface TagEditorTag {
  id: string;
  name: string;
  /** Machines other than Removed ones carrying the tag (spec 7.9). */
  machineCount: number;
}

/** A hand-applied tag type with its tags, or the tags with no tag type. */
export interface TagEditorGroup {
  /** Null for the tags with no tag type. */
  typeId: string | null;
  name: string;
  /** A machine holds at most one of its tags (spec 11.5). */
  exclusive: boolean;
  tags: TagEditorTag[];
}

/** The legend of the group of tags that have no tag type. */
export const UNTYPED_GROUP_NAME = "Other tags";

/**
 * The editor's groups in browse order (spec 11.14): hand-applied tag types by
 * name, then the tags with no tag type. Types with no tags are kept so a new
 * tag can be created in them.
 */
export function toTagEditorGroups(
  groups: readonly TagGroup[]
): TagEditorGroup[] {
  return groups.flatMap((group): TagEditorGroup[] => {
    if (group.kind === "automatic") return [];
    const tags = group.tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      machineCount: tag.machineCount,
    }));
    return group.kind === "hand"
      ? [
          {
            typeId: group.type.id,
            name: group.type.name,
            exclusive: group.type.exclusive,
            tags,
          },
        ]
      : [{ typeId: null, name: UNTYPED_GROUP_NAME, exclusive: false, tags }];
  });
}

/** A tag created from the editor that the server's groups may not list yet. */
export interface CreatedTag extends TagEditorTag {
  typeId: string | null;
}

/**
 * The groups with tags created in this editor merged in, each where 11.13–11.14
 * order puts it. Tags the server already lists are left where it put them, so
 * a row never jumps while someone is clicking it.
 */
export function mergeCreatedTags(
  groups: readonly TagEditorGroup[],
  created: readonly CreatedTag[]
): TagEditorGroup[] {
  const known = new Set(groups.flatMap((group) => group.tags.map((t) => t.id)));
  const pending = created.filter((tag) => !known.has(tag.id));
  if (pending.length === 0) return [...groups];
  return groups.map((group) => {
    const extra = pending
      .filter((tag) => tag.typeId === group.typeId)
      .map(({ id, name, machineCount }) => ({ id, name, machineCount }));
    return extra.length === 0
      ? group
      : { ...group, tags: orderHandTags([...group.tags, ...extra]) };
  });
}

/** One tag going on or coming off the machine. */
export interface TagChange {
  tagId: string;
  applied: boolean;
  /**
   * Tags the server takes off in the same write: the machine's other tags of
   * an exclusive tag type (spec 11.5).
   */
  clears: readonly string[];
}

/** The machine's applied tag ids after `changes`. */
export function applyTagChanges(
  applied: readonly string[],
  changes: readonly TagChange[]
): string[] {
  const next = new Set(applied);
  for (const change of changes) {
    for (const id of change.clears) next.delete(id);
    if (change.applied) next.add(change.tagId);
    else next.delete(change.tagId);
  }
  return [...next];
}
