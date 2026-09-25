/** Display metadata for a tag type (spec collections-and-tags 7.7–7.8). */
export interface TagTypeInfo {
  label: string;
  href: string;
  /** PinPoint derives membership from machine data; nobody assigns it. */
  automatic: boolean;
  /** One label line saying where membership comes from. */
  source: string;
}

export const MANUFACTURER_TAG_TYPE: TagTypeInfo = {
  label: "Manufacturer",
  href: "/c/tags/manufacturer",
  automatic: true,
  source: "Set from each machine's manufacturer",
};
