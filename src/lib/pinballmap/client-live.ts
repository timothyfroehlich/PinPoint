import "server-only";
import { log } from "~/lib/logger";
import { assertNotInTransaction } from "~/server/db/transaction-context";
import { PBM_API_BASE, PBM_USER_AGENT } from "./config";
import { parseCatalog, parseLocation } from "./parse";
import type {
  CatalogMachine,
  LocationSnapshot,
  PbmAddMachineResult,
  PbmAuthResult,
  PbmCredentials,
  PbmWriteResult,
  PinballMapClient,
} from "./types";

/**
 * Live PinballMap client — the only place real PBM HTTP happens.
 *
 * Conduct (vendored docs/external/pinballmap-llms.txt):
 * - reads are anonymous; writes append `user_email`/`user_token` as query params
 * - identify ourselves with a descriptive User-Agent
 * - back off on 429 within a small budget, then report `rate_limited`
 * - serialize writes so we never fire concurrent mutations at PBM
 *
 * SECURITY: write/auth URLs carry credentials in the query string, so we never
 * log the full URL — only a redacted path label.
 */

const MAX_RETRY_AFTER_SECONDS = 5;

type WriteReason = "rate_limited" | "unauthorized" | "not_found" | "transient";

function buildUrl(path: string, query?: Record<string, string>): string {
  const url = new URL(`${PBM_API_BASE}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  }
  return url.toString();
}

function credsQuery(
  credentials: PbmCredentials,
  extra?: Record<string, string>
): Record<string, string> {
  return {
    user_email: credentials.email,
    user_token: credentials.token,
    ...(extra ?? {}),
  };
}

/** Fetch wrapper that never throws and never logs credentialed URLs. */
async function safeFetch(
  url: string,
  init: RequestInit,
  label: string
): Promise<Response> {
  try {
    return await fetch(url, {
      ...init,
      headers: { "User-Agent": PBM_USER_AGENT, ...(init.headers ?? {}) },
    });
  } catch (err) {
    log.warn(
      { err, label, action: "pinballmap.fetch" },
      "PinballMap fetch failed"
    );
    return new Response(null, { status: 599 });
  }
}

function parseRetryAfter(res: Response): number {
  const header = res.headers.get("retry-after");
  if (header) {
    const n = Number.parseFloat(header);
    if (Number.isFinite(n)) return n;
  }
  return 1;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

function classifyWrite(status: number): WriteReason {
  if (status === 429) return "rate_limited";
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 404) return "not_found";
  return "transient";
}

// Module-level write chain: serialize all mutations so we never race PBM state
// or fire concurrent writes against their rate limits.
let writeChain: Promise<unknown> = Promise.resolve();
function serializeWrite<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeChain.then(fn, fn);
  // Keep the chain alive regardless of this write's outcome.
  writeChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

/** Issue a write, honoring one 429 retry within budget. */
async function writeRequest(
  method: "POST" | "PUT" | "DELETE",
  url: string,
  label: string
): Promise<{ ok: true; res: Response } | { ok: false; reason: WriteReason }> {
  let res = await safeFetch(url, { method }, label);
  if (res.status === 429) {
    const retryAfter = parseRetryAfter(res);
    if (retryAfter > MAX_RETRY_AFTER_SECONDS) {
      log.warn(
        { retryAfter, label, action: "pinballmap.rateLimit" },
        "PinballMap retry-after exceeds inline budget"
      );
      return { ok: false, reason: "rate_limited" };
    }
    await sleep(retryAfter * 1000);
    res = await safeFetch(url, { method }, label);
  }
  if (res.ok) return { ok: true, res };
  return { ok: false, reason: classifyWrite(res.status) };
}

async function readJson(path: string, label: string): Promise<unknown> {
  const res = await safeFetch(buildUrl(path), { method: "GET" }, label);
  if (!res.ok) {
    throw new Error(`PinballMap ${label} failed: HTTP ${res.status}`);
  }
  return res.json();
}

export function createLiveClient(): PinballMapClient {
  return {
    async fetchLocation(locationId: number): Promise<LocationSnapshot> {
      assertNotInTransaction("pinballmap.fetchLocation");
      const raw = await readJson(
        `/locations/${locationId}.json`,
        "fetchLocation"
      );
      return parseLocation(raw, new Date().toISOString());
    },

    async fetchCatalog(): Promise<CatalogMachine[]> {
      assertNotInTransaction("pinballmap.fetchCatalog");
      // Full payload (no `no_details`): that flag omits `ipdb_id`, which we
      // store on the machine record (vendored llms.txt §no_details).
      const raw = await readJson(`/machines.json`, "fetchCatalog");
      return parseCatalog(raw);
    },

    async authDetails(login: string, password: string): Promise<PbmAuthResult> {
      assertNotInTransaction("pinballmap.authDetails");
      // Credentials in the query string — never log this URL.
      const url = buildUrl(`/users/auth_details.json`, { login, password });
      const res = await safeFetch(url, { method: "GET" }, "authDetails");
      if (res.status === 429) return { ok: false, reason: "rate_limited" };
      if (res.status === 401 || res.status === 403 || res.status === 422) {
        return { ok: false, reason: "invalid_credentials" };
      }
      if (!res.ok) return { ok: false, reason: "transient" };
      const body = (await res.json().catch(() => null)) as {
        authentication_token?: unknown;
        username?: unknown;
      } | null;
      const token =
        typeof body?.authentication_token === "string"
          ? body.authentication_token
          : null;
      if (!token) return { ok: false, reason: "transient" };
      const username =
        typeof body?.username === "string" ? body.username : login;
      return { ok: true, token, username };
    },

    addMachine({
      credentials,
      locationId,
      machineId,
    }): Promise<PbmAddMachineResult> {
      assertNotInTransaction("pinballmap.addMachine");
      return serializeWrite(async () => {
        const url = buildUrl(
          `/location_machine_xrefs.json`,
          credsQuery(credentials, {
            location_id: String(locationId),
            machine_id: String(machineId),
          })
        );
        const result = await writeRequest("POST", url, "addMachine");
        if (!result.ok) return { ok: false, reason: result.reason };
        const body = (await result.res.json().catch(() => null)) as {
          id?: unknown;
          location_machine?: { id?: unknown };
        } | null;
        const lmxId =
          typeof body?.id === "number"
            ? body.id
            : typeof body?.location_machine?.id === "number"
              ? body.location_machine.id
              : null;
        if (lmxId === null) return { ok: false, reason: "transient" };
        return { ok: true, lmxId };
      });
    },

    removeMachine({ credentials, lmxId }): Promise<PbmWriteResult> {
      assertNotInTransaction("pinballmap.removeMachine");
      return serializeWrite(async () => {
        const url = buildUrl(
          `/location_machine_xrefs/${lmxId}.json`,
          credsQuery(credentials)
        );
        const result = await writeRequest("DELETE", url, "removeMachine");
        return result.ok ? { ok: true } : { ok: false, reason: result.reason };
      });
    },

    postCondition({ credentials, lmxId, comment }): Promise<PbmWriteResult> {
      assertNotInTransaction("pinballmap.postCondition");
      return serializeWrite(async () => {
        const url = buildUrl(
          `/location_machine_xrefs/${lmxId}.json`,
          credsQuery(credentials, { condition: comment })
        );
        const result = await writeRequest("PUT", url, "postCondition");
        return result.ok ? { ok: true } : { ok: false, reason: result.reason };
      });
    },

    setInsiderConnected({
      credentials,
      lmxId,
      enabled,
    }): Promise<PbmWriteResult> {
      assertNotInTransaction("pinballmap.setInsiderConnected");
      return serializeWrite(async () => {
        const url = buildUrl(
          `/location_machine_xrefs/${lmxId}/ic_toggle.json`,
          credsQuery(credentials, { ic_enabled: enabled ? "true" : "false" })
        );
        const result = await writeRequest("PUT", url, "setInsiderConnected");
        return result.ok ? { ok: true } : { ok: false, reason: result.reason };
      });
    },

    confirmLineup({ credentials, locationId }): Promise<PbmWriteResult> {
      assertNotInTransaction("pinballmap.confirmLineup");
      return serializeWrite(async () => {
        const url = buildUrl(
          `/locations/${locationId}/confirm.json`,
          credsQuery(credentials)
        );
        const result = await writeRequest("PUT", url, "confirmLineup");
        return result.ok ? { ok: true } : { ok: false, reason: result.reason };
      });
    },
  };
}
