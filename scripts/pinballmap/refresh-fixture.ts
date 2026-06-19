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
 * Real multi-edition families re-appended on every refresh.
 *
 * PinballMap models editions of one title (Pro/Premium/LE, original/remake) as
 * separate machines sharing a `machine_group_id`; the family display name lives
 * in /machine_groups.json. The APC slice is almost entirely single-edition
 * machines, so without these the family→edition picker's two-step path would
 * never appear in dev/preview or be exercised by the mock.
 *
 * These are REAL PBM records (ids, groups, OPDB/IPDB ids fetched live), so the
 * picker demo matches reality — Medieval Madness (Williams original + Chicago
 * Gaming remakes, group 18), Jurassic Park (group 78), Godzilla (group 88). The
 * writers below dedupe by id, so any of these that APC actually stocks is not
 * duplicated. Keeping them HERE means a live refresh preserves the full families
 * (the trimmed APC slice alone would only carry the editions APC owns).
 */
const DEMO_GROUPS = [
  { id: 18, name: "Medieval Madness" },
  { id: 78, name: "Jurassic Park" },
  { id: 88, name: "Godzilla" },
];
const DEMO_FAMILY_MACHINES = [
  {
    id: 642,
    name: "Medieval Madness",
    manufacturer: "Williams",
    year: 1997,
    opdb_id: "G5pe4-MePZv",
    ipdb_id: 4032,
    machine_group_id: 18,
  },
  {
    id: 2306,
    name: "Medieval Madness (Remake)",
    manufacturer: "Chicago Gaming",
    year: 2016,
    opdb_id: "G5pe4-MyNkp",
    ipdb_id: 6263,
    machine_group_id: 18,
  },
  {
    id: 2966,
    name: "Medieval Madness (Remake Royal Edition)",
    manufacturer: "Chicago Gaming",
    year: 2015,
    opdb_id: "G5pe4-MkPRV",
    ipdb_id: 6264,
    machine_group_id: 18,
  },
  {
    id: 3259,
    name: "Medieval Madness (Remake Special Edition)",
    manufacturer: "Chicago Gaming",
    year: 2016,
    opdb_id: "G5pe4-MrR1B",
    ipdb_id: null,
    machine_group_id: 18,
  },
  {
    id: 3507,
    name: "Medieval Madness (Remake LE)",
    manufacturer: "Chicago Gaming",
    year: 2015,
    opdb_id: "G5pe4-M61y6",
    ipdb_id: null,
    machine_group_id: 18,
  },
  {
    id: 4550,
    name: "Medieval Madness (Remake Merlin Edition)",
    manufacturer: "Chicago Gaming",
    year: 2025,
    opdb_id: "G5pe4-MrRrv",
    ipdb_id: null,
    machine_group_id: 18,
  },
  {
    id: 3167,
    name: "Jurassic Park (Pro)",
    manufacturer: "Stern",
    year: 2019,
    opdb_id: "GK17D-MdEqz",
    ipdb_id: 6573,
    machine_group_id: 78,
  },
  {
    id: 3168,
    name: "Jurassic Park (LE)",
    manufacturer: "Stern",
    year: 2019,
    opdb_id: "GK17D-MKNKd-AOyKv",
    ipdb_id: 6575,
    machine_group_id: 78,
  },
  {
    id: 3169,
    name: "Jurassic Park (Premium)",
    manufacturer: "Stern",
    year: 2019,
    opdb_id: "GK17D-MKNKd-A15Yn",
    ipdb_id: 6574,
    machine_group_id: 78,
  },
  {
    id: 3780,
    name: "Jurassic Park (30th Anniversary)",
    manufacturer: "Stern",
    year: 2023,
    opdb_id: "GK17D-MKNKd-AOxoz",
    ipdb_id: null,
    machine_group_id: 78,
  },
  {
    id: 3415,
    name: "Godzilla (Pro)",
    manufacturer: "Stern",
    year: 2021,
    opdb_id: "GweeP-MW95j",
    ipdb_id: 6841,
    machine_group_id: 88,
  },
  {
    id: 3416,
    name: "Godzilla (Premium)",
    manufacturer: "Stern",
    year: 2021,
    opdb_id: "GweeP-Ml9pZ-ARZoY",
    ipdb_id: 6842,
    machine_group_id: 88,
  },
  {
    id: 3417,
    name: "Godzilla (LE)",
    manufacturer: "Stern",
    year: 2021,
    opdb_id: "GweeP-Ml9pZ-A9vXB",
    ipdb_id: 6843,
    machine_group_id: 88,
  },
  {
    id: 4500,
    name: "Godzilla (70th Anniversary)",
    manufacturer: "Stern",
    year: 2024,
    opdb_id: "GweeP-Ml9pZ-AOvNL",
    ipdb_id: null,
    machine_group_id: 88,
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
  // Demo families last so the two-step picker always has multi-edition data,
  // deduped by id so an APC machine that's also a demo edition appears once
  // (a duplicate id would later break the upsert's ON CONFLICT).
  const seenMachineIds = new Set<unknown>();
  const trimmed = [...real, ...DEMO_FAMILY_MACHINES].filter((m) => {
    if (seenMachineIds.has(m.id)) return false;
    seenMachineIds.add(m.id);
    return true;
  });
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
  // Dedupe by id: a real referenced group can also be a demo group (18/78/88).
  const seenGroupIds = new Set<unknown>();
  const groups = [...realGroups, ...DEMO_GROUPS].filter((g) => {
    if (seenGroupIds.has(g.id)) return false;
    seenGroupIds.add(g.id);
    return true;
  });
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
