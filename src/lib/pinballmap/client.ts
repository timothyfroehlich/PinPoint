import "server-only";
import { getPinballMapApiToken } from "./api-token";
import { createLiveClient } from "./client-live";
import { getMockClient } from "./client-mock";
import { getPinballMapMode } from "./config";
import type { PinballMapClient } from "./types";

/**
 * Returns the active PinballMap client — live or mock, per `PINBALLMAP_MODE`
 * (see `./config`). All app code (sync route, server actions, pickers) reaches
 * PBM through this, never through raw fetch.
 *
 * Async because the live client needs PBM's mandatory blanket API token
 * (X-Api-Token, PP-uusr), decrypted from Vault via a service-role RPC before
 * construction. That Vault round-trip is a side effect — callers already reach
 * PBM outside any transaction (state.ts/catalog.ts; CORE-ARCH-011). The mock
 * needs no token and is a process singleton so its in-memory state survives
 * across requests in dev.
 */
export async function getPinballMapClient(): Promise<PinballMapClient> {
  if (getPinballMapMode() === "mock") return getMockClient();
  return createLiveClient(await getPinballMapApiToken());
}

export type { PinballMapClient } from "./types";
