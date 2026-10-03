import type { CollectionMachine } from "~/lib/collections/owner";

/** Every tag type, in the order the tag browse and a machine's page list them. */
export const TAG_TYPE_IDS = [
  "manufacturer",
  "type",
  "display",
  "player-count",
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
  "player-count": {
    id: "player-count",
    label: "Player Count",
    href: "/c/tags/player-count",
    automatic: true,
    source: "Set from each machine's OPDB record",
  },
};

export function isTagTypeId(value: string): value is TagTypeId {
  return TAG_TYPE_IDS.some((id) => id === value);
}

/** The public page for one automatic tag. */
export function tagHref(type: TagTypeId, slug: string): string {
  return `${TAG_TYPES[type].href}/${encodeURIComponent(slug)}`;
}

/**
 * The URL segment that stands in for a tag type on the page of a hand-applied
 * tag that has none: `/c/tags/other/<slug>`. Reserved, so no tag type can take
 * it as its slug.
 */
export const UNTYPED_TAG_SEGMENT = "other";

/** A hand-applied tag type's page (spec 7.7). */
export function handTagTypeHref(typeSlug: string): string {
  return `/c/tags/${typeSlug}`;
}

/** A hand-applied tag's page, under its tag type or {@link UNTYPED_TAG_SEGMENT}. */
export function handTagHref(typeSlug: string | null, slug: string): string {
  return `/c/tags/${typeSlug ?? UNTYPED_TAG_SEGMENT}/${slug}`;
}

/** A tag type people apply by hand (spec 11.1). */
export interface HandTagType {
  id: string;
  slug: string;
  name: string;
  /** A machine holds at most one of its tags (spec 11.5). */
  exclusive: boolean;
  href: string;
}

interface TagFields {
  slug: string;
  name: string;
  href: string;
  /** Alphabetical by machine name, in every presence state. */
  machines: CollectionMachine[];
}

/** A tag PinPoint derives from machine data (spec §8, §9). */
export interface AutomaticTag extends TagFields {
  kind: "automatic";
  type: TagTypeId;
}

/** A tag people apply to machines (spec §11). */
export interface HandTag extends TagFields {
  kind: "hand";
  id: string;
  /** Null for a tag with no tag type. */
  typeId: string | null;
}

/** One tag and its machines. */
export type MachineTag = AutomaticTag | HandTag;

/**
 * One group of the tag browse (spec 7.3, 11.13–11.14): an automatic tag type,
 * a hand-applied tag type, or the hand-applied tags with no tag type.
 */
export type TagGroup =
  | { kind: "automatic"; type: TagTypeInfo; tags: AutomaticTag[] }
  | { kind: "hand"; type: HandTagType; tags: HandTag[] }
  | { kind: "untyped"; tags: HandTag[] };

export type HandTagGroup = Extract<TagGroup, { kind: "hand" | "untyped" }>;
