/** The metadata needed to determine one machine's current manufacturer. */
export interface MachineManufacturerSource {
  pinballmapMachineId: number | null;
  pinballmapExcluded: boolean;
  manufacturer: string | null;
  pinballmapTitle: { manufacturer: string | null } | null;
}

function cleanManufacturer(value: string | null | undefined): string | null {
  const cleaned = value?.trim().replace(/\s+/g, " ") ?? "";
  return cleaned === "" || cleaned.toLowerCase() === "unknown" ? null : cleaned;
}

/**
 * A linked machine follows the locally mirrored catalog. Its copied column is
 * the fallback if that catalog row disappears during refresh.
 * An explicitly excluded machine uses its hand-entered value. An undeclared
 * machine has no manufacturer claim, even if stale metadata remains on its row.
 */
export function getCurrentManufacturer(
  source: MachineManufacturerSource
): string | null {
  if (source.pinballmapMachineId !== null) {
    return source.pinballmapTitle === null
      ? cleanManufacturer(source.manufacturer)
      : cleanManufacturer(source.pinballmapTitle.manufacturer);
  }
  return source.pinballmapExcluded
    ? cleanManufacturer(source.manufacturer)
    : null;
}

/** Case and stray spaces do not split otherwise identical manufacturer tags. */
export function manufacturerTagKey(value: string | null): string | null {
  return cleanManufacturer(value)?.toLowerCase() ?? null;
}

/**
 * The URL segment for a manufacturer tag: its key with spaces as hyphens.
 * Readable over invertible — "stern electronics" and a hand-entered
 * "Stern-Electronics" would share a segment, so a tag page groups by segment.
 */
export function manufacturerTagSlug(key: string): string {
  return key.replaceAll(" ", "-");
}

export interface ManufacturerTagGroup<T> {
  slug: string;
  /**
   * The spelling most of its machines use. Ties go to code-point order, which
   * puts "Bally" ahead of "bally".
   */
  name: string;
  machines: T[];
}

/** Group machines by manufacturer tag, sorted by tag name. Untagged machines are dropped. */
export function groupManufacturerTags<
  T extends { manufacturer: string | null },
>(machines: readonly T[]): ManufacturerTagGroup<T>[] {
  const groups = new Map<
    string,
    { machines: T[]; spellings: Map<string, number> }
  >();
  for (const machine of machines) {
    const key = manufacturerTagKey(machine.manufacturer);
    if (key === null || machine.manufacturer === null) continue;
    const slug = manufacturerTagSlug(key);
    let group = groups.get(slug);
    if (group === undefined) {
      group = { machines: [], spellings: new Map() };
      groups.set(slug, group);
    }
    group.machines.push(machine);
    const spelling = machine.manufacturer;
    group.spellings.set(spelling, (group.spellings.get(spelling) ?? 0) + 1);
  }
  return [...groups]
    .map(([slug, group]) => ({
      slug,
      name:
        [...group.spellings].sort(
          ([leftName, leftCount], [rightName, rightCount]) =>
            rightCount - leftCount ||
            (leftName < rightName ? -1 : leftName > rightName ? 1 : 0)
        )[0]?.[0] ?? slug,
      machines: group.machines,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

/** The public page for one manufacturer tag. */
export function manufacturerTagHref(slug: string): string {
  return `/c/tags/manufacturer/${encodeURIComponent(slug)}`;
}

/** The tag link for one machine's current manufacturer, or null for none. */
export function manufacturerTagLink(
  manufacturer: string | null
): { name: string; href: string } | null {
  const key = manufacturerTagKey(manufacturer);
  if (key === null || manufacturer === null) return null;
  return {
    name: manufacturer,
    href: manufacturerTagHref(manufacturerTagSlug(key)),
  };
}
