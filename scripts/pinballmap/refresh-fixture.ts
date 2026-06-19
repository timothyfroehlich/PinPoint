/**
 * Refresh the committed PinballMap fixtures from live PBM data.
 *
 * READ-ONLY against PinballMap (GET only). Run manually when the captured
 * snapshot drifts enough to be unrepresentative:
 *
 *   pnpm tsx scripts/pinballmap/refresh-fixture.ts
 *
 * Writes:
 * - src/lib/pinballmap/fixtures/location-26454.json  — raw location payload (verbatim)
 * - src/lib/pinballmap/fixtures/catalog-apc.json      — catalog trimmed to our machine ids
 * - src/lib/pinballmap/fixtures/machine-groups.json   — groups referenced by those machines
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

/**
 * Hand-authored demo families re-appended on every refresh.
 *
 * PinballMap models editions of one title (Pro/Premium/LE) as separate machines
 * sharing a `machine_group_id`; the family display name lives in
 * /machine_groups.json. The real APC slice is almost entirely single-edition
 * machines, so without these the family→edition picker's two-step path would
 * never appear in dev/preview or be exercised by the mock. These are realistic
 * (real Stern titles/years/OPDB ids) but use synthetic high ids (90xxx / 90xx)
 * that cannot collide with real PBM ids. Keeping them HERE means a live refresh
 * preserves them instead of silently dropping the demo.
 */
const DEMO_GROUPS = [
  { id: 9001, name: "Godzilla" },
  { id: 9002, name: "Jurassic Park" },
];
const DEMO_FAMILY_MACHINES = [
  {
    id: 90011,
    name: "Godzilla (Pro)",
    manufacturer: "Stern",
    year: 2021,
    opdb_id: "G50r-MLeqP",
    ipdb_id: 6845,
    machine_group_id: 9001,
  },
  {
    id: 90012,
    name: "Godzilla (Premium)",
    manufacturer: "Stern",
    year: 2021,
    opdb_id: "G50r-MLqLz",
    ipdb_id: 6845,
    machine_group_id: 9001,
  },
  {
    id: 90013,
    name: "Godzilla (Limited Edition)",
    manufacturer: "Stern",
    year: 2021,
    opdb_id: "G50r-MLxkP",
    ipdb_id: 6845,
    machine_group_id: 9001,
  },
  {
    id: 90021,
    name: "Jurassic Park (Pro)",
    manufacturer: "Stern",
    year: 2019,
    opdb_id: "GrqZP-MQk6e",
    ipdb_id: 6593,
    machine_group_id: 9002,
  },
  {
    id: 90022,
    name: "Jurassic Park (Premium)",
    manufacturer: "Stern",
    year: 2019,
    opdb_id: "GrqZP-MQ5dN",
    ipdb_id: 6593,
    machine_group_id: 9002,
  },
  {
    id: 90023,
    name: "Jurassic Park (Limited Edition)",
    manufacturer: "Stern",
    year: 2019,
    opdb_id: "GrqZP-MQ9xW",
    ipdb_id: 6593,
    machine_group_id: 9002,
  },
];

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
  const locationParsed: unknown = JSON.parse(locationText);
  const locationRecord =
    typeof locationParsed === "object" && locationParsed !== null
      ? (locationParsed as Record<string, unknown>)
      : null;
  const xrefsRaw = locationRecord?.["location_machine_xrefs"];
  const xrefs: unknown[] = Array.isArray(xrefsRaw) ? xrefsRaw : [];
  const machineIds = new Set(
    xrefs
      .map((x) =>
        typeof x === "object" && x !== null
          ? (x as Record<string, unknown>)["machine_id"]
          : null
      )
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
  const real = all
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
      machine_group_id: m["machine_group_id"] ?? null,
    }));
  // Demo families last so the two-step picker always has multi-edition data.
  const trimmed = [...real, ...DEMO_FAMILY_MACHINES];
  writeFileSync(
    join(FIXTURES, "catalog-apc.json"),
    `${JSON.stringify(trimmed, null, 2)}\n`
  );

  // 3. Machine groups (family display names), trimmed to the groups our
  // machines actually reference, plus the demo groups.
  const referencedGroupIds = new Set(
    real
      .map((m) => m.machine_group_id)
      .filter((id): id is number => typeof id === "number")
  );
  const groupsText = await getText(`/machine_groups.json`);
  const groupsParsed: unknown = JSON.parse(groupsText);
  const groupsWrapper =
    typeof groupsParsed === "object" && groupsParsed !== null
      ? (groupsParsed as Record<string, unknown>)
      : null;
  const groupsField = groupsWrapper?.["machine_groups"];
  const allGroups: unknown[] = Array.isArray(groupsParsed)
    ? groupsParsed
    : Array.isArray(groupsField)
      ? groupsField
      : [];
  const realGroups = allGroups
    .map((g) =>
      typeof g === "object" && g !== null
        ? (g as Record<string, unknown>)
        : null
    )
    .filter((g): g is Record<string, unknown> => {
      if (g === null) return false;
      const id = g["id"];
      return typeof id === "number" && referencedGroupIds.has(id);
    })
    .map((g) => ({ id: g["id"], name: g["name"] ?? null }));
  const groups = [...realGroups, ...DEMO_GROUPS];
  writeFileSync(
    join(FIXTURES, "machine-groups.json"),
    `${JSON.stringify(groups, null, 2)}\n`
  );

  process.stdout.write(
    `Refreshed fixtures: ${machineIds.size} machines at location, ` +
      `${real.length} real + ${DEMO_FAMILY_MACHINES.length} demo catalog entries, ` +
      `${groups.length} machine groups.\n`
  );
}

main().catch((err: unknown) => {
  process.stderr.write(`refresh-fixture failed: ${String(err)}\n`);
  process.exitCode = 1;
});
