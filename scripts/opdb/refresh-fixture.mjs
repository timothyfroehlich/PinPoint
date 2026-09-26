#!/usr/bin/env node
/**
 * Refresh the committed OPDB fixture from the live export (PP-wqit.12).
 *
 *   node scripts/opdb/refresh-fixture.mjs
 *
 * Writes src/lib/opdb/fixtures/opdb-apc.json: the export's entries for every
 * OPDB ID in the PinballMap catalog fixture (plus each alias's machine-level
 * entry), reduced to the fields PinPoint parses. The dev seed and tests read
 * this file, so neither touches the network. Run it by hand when the catalog
 * fixture changes; nothing runs it automatically.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const EXPORT_URL =
  "https://mp-data.sfo3.cdn.digitaloceanspaces.com/opdb-v2.json";
const root = process.cwd();
const catalog = JSON.parse(
  readFileSync(
    join(root, "src/lib/pinballmap/fixtures/catalog-apc.json"),
    "utf8"
  )
);

const machineLevel = (id) => {
  const alias = id.indexOf("-A");
  return alias === -1 ? id : id.slice(0, alias);
};
const wanted = new Set(
  catalog
    .map((m) => m.opdb_id)
    .filter((id) => typeof id === "string" && id.length > 0)
    .flatMap((id) => [id, machineLevel(id)])
);

const response = await fetch(EXPORT_URL, {
  headers: {
    "User-Agent":
      "PinPoint/1.0 (Austin Pinball Collective issue tracker; +https://github.com/timothyfroehlich/PinPoint)",
  },
});
if (!response.ok) {
  console.error(`❌ OPDB export request failed: HTTP ${response.status}`);
  process.exit(1);
}
const { entries } = await response.json();

const keep = ["opdbId", "name", "type", "display", "playerCount", "people"];
const picked = entries
  .filter((e) => wanted.has(e.opdbId))
  .map((e) => Object.fromEntries(keep.map((k) => [k, e[k]])))
  .sort((a, b) => a.opdbId.localeCompare(b.opdbId));

writeFileSync(
  join(root, "src/lib/opdb/fixtures/opdb-apc.json"),
  `${JSON.stringify({ entries: picked }, null, 2)}\n`
);
const missing = [...wanted].filter(
  (id) => !picked.some((e) => e.opdbId === id)
);
console.log(
  `✅ Wrote ${picked.length} OPDB entries; ${missing.length} IDs not in the export.`
);
