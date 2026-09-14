import "server-only";
import { getPinballMapApiToken } from "./api-token";
import { createLiveClient } from "./client-live";
import { getMockClient } from "./client-mock";
import { getPinballMapMode } from "./config";
import type { PinballMapClient, PinballMapRegion } from "./types";

/**
 * Returns the active PinballMap client — live or mock, per `PINBALLMAP_MODE`
 * (see `./config`). All app code (sync route, server actions, pickers) reaches
 * PBM through this, never through raw fetch.
 *
 * Construction is now entirely synchronous — the live client's mandatory blanket
 * API token (X-Api-Token, PP-uusr) is read straight off `process.env` rather than
 * decrypted from Vault through a service-role RPC (PP-o355.23), so there is no
 * round-trip left. It still returns a Promise because this is the seam every PBM
 * caller goes through and they all already await it; narrowing the return type
 * would churn state.ts, catalog.ts and four integration-test mocks for no
 * behaviour change.
 * The mock needs no token and is a process singleton so its in-memory state
 * survives across requests in dev.
 */
export function getPinballMapClient(): Promise<PinballMapClient> {
  if (getPinballMapMode() === "mock") return Promise.resolve(getMockClient());
  return Promise.resolve(createLiveClient(getPinballMapApiToken()));
}

export type { PinballMapClient, PinballMapRegion } from "./types";

let cachedRegions: { expiresAt: number; regions: PinballMapRegion[] } | null =
  null;
const REGIONS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Fetch Pinball Map regions with a long cache TTL (24h).
 * Regions change very rarely; sorting by formalName ensures consistent picker ordering.
 */
export async function getRegions(): Promise<PinballMapRegion[]> {
  const now = Date.now();
  if (cachedRegions && cachedRegions.expiresAt > now) {
    return cachedRegions.regions;
  }
  const client = await getPinballMapClient();
  const regions = await client.fetchRegions();
  const sorted = [...regions].sort((a, b) =>
    a.formalName.localeCompare(b.formalName)
  );
  cachedRegions = {
    regions: sorted,
    expiresAt: now + REGIONS_CACHE_TTL_MS,
  };
  return sorted;
}
