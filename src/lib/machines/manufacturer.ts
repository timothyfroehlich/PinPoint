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
