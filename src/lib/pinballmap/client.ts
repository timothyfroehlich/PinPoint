import "server-only";
import { createLiveClient } from "./client-live";
import { getMockClient } from "./client-mock";
import { getPinballMapMode } from "./config";
import type { PinballMapClient } from "./types";

/**
 * Returns the active PinballMap client — live or mock, per `PINBALLMAP_MODE`
 * (see `./config`). All app code (sync route, server actions, pickers) reaches
 * PBM through this, never through raw fetch.
 *
 * The live client is stateless and cheap to construct; the mock is a process
 * singleton so its in-memory state survives across requests in dev.
 */
export function getPinballMapClient(): PinballMapClient {
  return getPinballMapMode() === "live" ? createLiveClient() : getMockClient();
}

export type { PinballMapClient } from "./types";
