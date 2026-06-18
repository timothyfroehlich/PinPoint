/**
 * Refresh the committed PinballMap fixtures from live PBM data.
 *
 * READ-ONLY against PinballMap (GET only). Run manually when the captured
 * snapshot drifts enough to be unrepresentative:
 *
 *   pnpm tsx scripts/pinballmap/refresh-fixture.ts
 *
 * Writes:
 * - src/lib/pinballmap/fixtures/location-26454.json — raw location payload (verbatim)
 * - src/lib/pinballmap/fixtures/catalog-apc.json     — catalog trimmed to our machine ids
 *
 * Constants mirror src/lib/pinballmap/config.ts (kept inline so this script has
 * no app/path-alias dependencies).
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const PBM_API_BASE = "https://pinballmap.com/api/v1";
const PBM_USER_AGENT =
  "PinPoint/1.0 (Austin Pinball Collective issue tracker; +https://github.com/timothyfroehlich/PinPoint)";
const APC_LOCATION_ID = 26454;

const FIXTURES = join(process.cwd(), "src/lib/pinballmap/fixtures");

async function getText(path: string): Promise<string> {
  const res = await fetch(`${PBM_API_BASE}${path}`, {
    headers: { "User-Agent": PBM_USER_AGENT },
  });
  if (!res.ok) {
    throw new Error(`GET ${path} failed: HTTP ${res.status}`);
  }
  return res.text();
}

async function main(): Promise<void> {
  // 1. Location snapshot — written verbatim so future refreshes diff cleanly.
  const locationText = await getText(`/locations/${APC_LOCATION_ID}.json`);
  writeFileSync(join(FIXTURES, "location-26454.json"), locationText);
  const location = JSON.parse(locationText) as {
    location_machine_xrefs?: { machine_id?: number }[];
  };
  const machineIds = new Set(
    (location.location_machine_xrefs ?? [])
      .map((l) => l.machine_id)
      .filter((id): id is number => typeof id === "number")
  );

  // 2. Catalog trimmed to the machines actually at our location.
  const machinesText = await getText(`/machines.json`);
  const parsed: unknown = JSON.parse(machinesText);
  const wrapper =
    typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  const machinesField = wrapper?.["machines"];
  const all: unknown[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray(machinesField)
      ? machinesField
      : [];
  const trimmed = all
    .map((m) =>
      typeof m === "object" && m !== null
        ? (m as Record<string, unknown>)
        : null
    )
    .filter((m): m is Record<string, unknown> => {
      if (m === null) return false;
      const id = m["id"];
      return typeof id === "number" && machineIds.has(id);
    })
    .map((m) => ({
      id: m["id"],
      name: m["name"] ?? null,
      manufacturer: m["manufacturer"] ?? null,
      year: m["year"] ?? null,
      opdb_id: m["opdb_id"] ?? null,
      ipdb_id: m["ipdb_id"] ?? null,
    }));
  writeFileSync(
    join(FIXTURES, "catalog-apc.json"),
    `${JSON.stringify(trimmed, null, 2)}\n`
  );

  process.stdout.write(
    `Refreshed fixtures: ${machineIds.size} machines at location, ${trimmed.length} catalog entries.\n`
  );
}

main().catch((err: unknown) => {
  process.stderr.write(`refresh-fixture failed: ${String(err)}\n`);
  process.exitCode = 1;
});
