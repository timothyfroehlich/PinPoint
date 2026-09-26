/** Every tag type, in the order the tag browse and a machine's page list them. */
export const TAG_TYPE_IDS = [
  "manufacturer",
  "type",
  "display",
  "players",
] as const;
export type TagTypeId = (typeof TAG_TYPE_IDS)[number];

/** Display metadata for a tag type (spec collections-and-tags 7.7–7.8). */
export interface TagTypeInfo {
  id: TagTypeId;
  label: string;
  href: string;
  /** PinPoint derives membership from machine data; nobody assigns it. */
  automatic: boolean;
  /** One label line saying where membership comes from. */
  source: string;
}

export const TAG_TYPES: Record<TagTypeId, TagTypeInfo> = {
  manufacturer: {
    id: "manufacturer",
    label: "Manufacturer",
    href: "/c/tags/manufacturer",
    automatic: true,
    source: "Set from each machine's manufacturer",
  },
  type: {
    id: "type",
    label: "Type",
    href: "/c/tags/type",
    automatic: true,
    source: "Set from each machine's OPDB record",
  },
  display: {
    id: "display",
    label: "Display",
    href: "/c/tags/display",
    automatic: true,
    source: "Set from each machine's OPDB record",
  },
  players: {
    id: "players",
    label: "Players",
    href: "/c/tags/players",
    automatic: true,
    source: "Set from each machine's OPDB record",
  },
};

export function isTagTypeId(value: string): value is TagTypeId {
  return TAG_TYPE_IDS.some((id) => id === value);
}

/** The public page for one tag. */
export function tagHref(type: TagTypeId, slug: string): string {
  return `${TAG_TYPES[type].href}/${encodeURIComponent(slug)}`;
}
