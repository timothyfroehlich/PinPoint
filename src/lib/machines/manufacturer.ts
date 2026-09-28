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

function codePointOrder(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * The readable URL segment for a tag key: spaces become hyphens. Two keys can
 * share one ("stern electronics", "stern-electronics"), so
 * `groupManufacturerTags` suffixes the later one to keep addresses unique.
 */
function baseTagSlug(key: string): string {
  return key.replaceAll(" ", "-");
}

export interface ManufacturerTagGroup<T> {
  /** Unique URL segment; see `baseTagSlug`. */
  slug: string;
  /**
   * The spelling most of its machines use. Ties go to code-point order, which
   * puts "Bally" ahead of "bally".
   */
  name: string;
  machines: T[];
}

/**
 * Group machines by manufacturer tag (spec collections-and-tags 8.2–8.4),
 * sorted by tag name. Untagged machines are dropped. When two tags share a
 * readable segment, the one whose key sorts later gets "-2", "-3", ….
 */
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
    let group = groups.get(key);
    if (group === undefined) {
      group = { machines: [], spellings: new Map() };
      groups.set(key, group);
    }
    group.machines.push(machine);
    const spelling = machine.manufacturer;
    group.spellings.set(spelling, (group.spellings.get(spelling) ?? 0) + 1);
  }

  const usedSlugs = new Set<string>();
  const tags: ManufacturerTagGroup<T>[] = [];
  for (const [key, group] of [...groups].sort(([left], [right]) =>
    codePointOrder(left, right)
  )) {
    const base = baseTagSlug(key);
    let slug = base;
    for (let n = 2; usedSlugs.has(slug); n += 1) slug = `${base}-${String(n)}`;
    usedSlugs.add(slug);
    tags.push({
      slug,
      name:
        [...group.spellings].sort(
          ([leftName, leftCount], [rightName, rightCount]) =>
            rightCount - leftCount || codePointOrder(leftName, rightName)
        )[0]?.[0] ?? key,
      machines: group.machines,
    });
  }
  return tags.sort((left, right) => left.name.localeCompare(right.name));
}
