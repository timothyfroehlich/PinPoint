import "server-only";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { checkPermission } from "~/lib/permissions/helpers";
import {
  CATALOG_SEARCH_LIMIT,
  isCatalogEmpty,
  listGroupEditions,
  searchCatalogFamilies,
  type CatalogEdition,
  type CatalogFamily,
} from "~/lib/pinballmap/catalog";

import { McpToolError, runTool, type ToolOutcome } from "./shared";
import type { McpAuthContext } from "~/lib/mcp/verify-token";

/**
 * Upper bound on `limit`. This is a disambiguation aid, not an enumeration
 * surface — there is no offset, so a caller that hits `hasMore` should narrow
 * the query rather than page (families come back best-match first).
 */
const MAX_LIMIT = 50;

const searchPinballmapCatalogSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe(
      "Title or family name to search for, e.g. 'elvira'. Returns families (a title's edition group, or a standalone title). A family with machineGroupId null, or editionCount 1, is already a single title — its pinballmapMachineId is the answer."
    ),
  machineGroupId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "List one family's individual editions instead of searching. Use the machineGroupId of a family returned by a query — NOT its pinballmapMachineId, which identifies a single edition. Only for a family whose machineGroupId is non-null AND whose editionCount is above 1; anything else already resolves to one title, so this call is unnecessary. An id no family has is an error, never an empty list."
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(MAX_LIMIT)
    .optional()
    .describe(
      `Maximum families to return when searching (default ${CATALOG_SEARCH_LIMIT}). Ignored when listing a family's editions — every edition is returned.`
    ),
});

type SearchPinballmapCatalogArgs = z.infer<
  typeof searchPinballmapCatalogSchema
>;

/** The picker's first step: families matching a query. */
export interface McpCatalogFamilyResult {
  mode: "families";
  query: string;
  /**
   * How many families are in `families` — a page size, NOT a total. Named
   * `returned` rather than `count` deliberately: `list_machines` teaches the
   * caller to answer counting questions from `total` and never from `count`, and
   * a search of a ~10k-row catalog has no cheap, meaningful total to offer.
   * Nothing here answers "how many titles are there".
   */
  returned: number;
  /** True when more families matched than `limit` returned. */
  hasMore: boolean;
  families: CatalogFamily[];
}

/** The picker's second step: one family's individual editions. */
export interface McpCatalogEditionResult {
  mode: "editions";
  machineGroupId: number;
  /** Every edition in the family — unpaged, so this one IS the total. */
  returned: number;
  editions: CatalogEdition[];
}

/**
 * Refuse to characterise an empty result when the mirror itself is empty.
 *
 * Both branches of this tool return or explain "nothing found", and both
 * explanations are claims about Pinball Map's catalog — which we can only make
 * from a populated mirror. `refreshCatalog` runs weekly and no-ops on an empty
 * upstream read, so an unpopulated mirror is a live state (fresh preview branch,
 * a local DB seeded from a prod dump, a run of failed refreshes), not a
 * theoretical one. Fail loudly instead: the caller can act on "PinPoint has no
 * catalog data" and cannot act on a silent, permanent "no match".
 */
async function assertCatalogPopulated(): Promise<void> {
  if (await isCatalogEmpty()) {
    throw new McpToolError(
      "not_found",
      "PinPoint's local Pinball Map catalog mirror is empty, so no lookup can succeed — this says nothing about what is or isn't on Pinball Map, and it is not a wrong id. The mirror is filled by a weekly cron (/api/cron/refresh-catalog); a fresh preview branch or a database seeded without it will have no rows. Retrying won't help until it's populated."
    );
  }
}

/**
 * Search the local PinballMap catalog mirror, mirroring the web linking picker's
 * two steps: a `query` returns families (each with an `editionCount`), and a
 * `machineGroupId` returns that family's individual editions with their
 * `pinballmapMachineId`s.
 *
 * Read-only, and reads the `pinballmap_catalog` mirror only — never
 * pinballmap.com (CORE-PBM-001).
 *
 * Gated on `machines.view` (CORE-ARCH-008): the catalog is mirrored *public* PBM
 * data, so it carries the same read bar as machine detail — the same call the
 * web picker's seam makes, where authentication is the only gate. The MCP door
 * already requires an admin; this is defense in depth.
 */
export async function runSearchPinballmapCatalog(
  args: SearchPinballmapCatalogArgs,
  ctx: McpAuthContext
): Promise<ToolOutcome> {
  if (!checkPermission("machines.view", ctx.accessLevel)) {
    throw new McpToolError(
      "denied",
      "You cannot view the Pinball Map catalog."
    );
  }

  const { query, machineGroupId } = args;

  // Exactly one of the two — the tool does two different things, and silently
  // ignoring the argument that lost would hide which one ran.
  if (query !== undefined && machineGroupId !== undefined) {
    throw new McpToolError(
      "invalid",
      "Pass either query (to search families) or machineGroupId (to list one family's editions), not both."
    );
  }

  if (machineGroupId !== undefined) {
    const editions = await listGroupEditions(machineGroupId);
    if (editions.length === 0) {
      // Zero rows has two very different causes, and only one of them is the
      // caller's fault. Diagnose before accusing: asserting the wrong-id
      // explanation against an unpopulated mirror is itself the confident wrong
      // answer CORE-ARCH-012 forbids.
      await assertCatalogPopulated();
      // The mirror has rows, so this id genuinely matches no family. The
      // families payload hands back `machineGroupId` and `pinballmapMachineId`
      // as adjacent bare integers, so grabbing the wrong one is the predictable
      // mistake — name it, or the caller reports an empty family as fact.
      throw new McpToolError(
        "not_found",
        `No Pinball Map family has machineGroupId ${machineGroupId}. If you took that number from a family's 'pinballmapMachineId', that's the id of a single edition, not the family — pass the family's 'machineGroupId' instead, or search by name again.`
      );
    }
    const result: McpCatalogEditionResult = {
      mode: "editions",
      machineGroupId,
      returned: editions.length,
      editions,
    };
    return { result };
  }

  if (query === undefined) {
    throw new McpToolError(
      "invalid",
      "Pass query to search Pinball Map families, or machineGroupId to list one family's editions."
    );
  }

  const limit = args.limit ?? CATALOG_SEARCH_LIMIT;
  // Over-fetch by one so `hasMore` is exact rather than inferred from a full
  // page — an enumerating caller shouldn't have to guess whether it saw
  // everything (the miscount PP-u4ab.4 fixed on list_machines).
  const rows = await searchCatalogFamilies(query, limit + 1);
  const families = rows.slice(0, limit);
  // An empty result set reads as "that title isn't on Pinball Map" — a claim
  // about PBM we have no standing to make when the mirror we searched is empty.
  if (families.length === 0) {
    await assertCatalogPopulated();
  }
  const result: McpCatalogFamilyResult = {
    mode: "families",
    query,
    returned: families.length,
    hasMore: rows.length > limit,
    families,
  };
  return { result };
}

export function registerSearchPinballmapCatalog(server: McpServer): void {
  server.registerTool(
    "search_pinballmap_catalog",
    {
      title: "Search the Pinball Map catalog",
      description:
        "Find a Pinball Map catalog title to identify a machine's model/edition. Two steps, like the web picker: pass `query` to get matching families (an edition group such as 'Elvira's House of Horrors', or a standalone title) with an `editionCount`; then, ONLY for a family with a non-null `machineGroupId` and `editionCount` above 1, pass that `machineGroupId` to list its individual editions (Pro/Premium/LE) with the `pinballmapMachineId` of each. A standalone title — `machineGroupId` null, or `editionCount` 1 — already carries its `pinballmapMachineId`: that is the answer, don't call again. Most pre-1990s machines are standalone. Pass one argument or the other, never both. `returned` is this page's size, not a total — this tool cannot answer 'how many titles are there'; when `hasMore` is true, narrow the query, as families come back best-match first and there is no paging. Read-only, served from PinPoint's local catalog mirror.",
      inputSchema: searchPinballmapCatalogSchema.shape,
    },
    (args, extra) =>
      runTool("search_pinballmap_catalog", extra, (ctx) =>
        runSearchPinballmapCatalog(args, ctx)
      )
  );
}
