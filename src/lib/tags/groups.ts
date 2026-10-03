import {
  TAG_TYPE_IDS,
  TAG_TYPES,
  type AutomaticTag,
  type HandTag,
  type HandTagType,
  type TagGroup,
  type TagTypeId,
} from "./types";

/** Name order for tag types and tags: ignores case, reads digits as numbers. */
export function compareTagNames(left: string, right: string): number {
  return (
    left.localeCompare(right, "en", { sensitivity: "base", numeric: true }) ||
    (left < right ? -1 : left > right ? 1 : 0)
  );
}

/**
 * Tags with machines first, then tags with none, each part ordered by name
 * (spec 11.13–11.14).
 */
export function orderHandTags<T extends Pick<HandTag, "name" | "machines">>(
  tags: readonly T[]
): T[] {
  return [...tags].sort(
    (left, right) =>
      Number(left.machines.length === 0) -
        Number(right.machines.length === 0) ||
      compareTagNames(left.name, right.name)
  );
}

/**
 * Every tag group in browse order (spec 7.3, 11.14): each automatic tag type in
 * its fixed order with its tags in their own order, then hand-applied tag
 * types by name, then the tags with no tag type. Every automatic and
 * hand-applied type gets a group even with no tags, so a caller can find a
 * type's page; the browse decides which empty groups to show.
 */
export function buildTagGroups(
  automatic: Readonly<Record<TagTypeId, AutomaticTag[]>>,
  types: readonly HandTagType[],
  handTags: readonly HandTag[]
): TagGroup[] {
  const byType = new Map<string | null, HandTag[]>();
  for (const tag of handTags) {
    const list = byType.get(tag.typeId);
    if (list) list.push(tag);
    else byType.set(tag.typeId, [tag]);
  }
  return [
    ...TAG_TYPE_IDS.map((id): TagGroup => ({
      kind: "automatic",
      type: TAG_TYPES[id],
      tags: automatic[id],
    })),
    ...[...types]
      .sort((left, right) => compareTagNames(left.name, right.name))
      .map((type): TagGroup => ({
        kind: "hand",
        type,
        tags: orderHandTags(byType.get(type.id) ?? []),
      })),
    { kind: "untyped", tags: orderHandTags(byType.get(null) ?? []) },
  ];
}
