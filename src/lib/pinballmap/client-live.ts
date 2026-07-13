import "server-only";
import { log } from "~/lib/logger";
import { assertNotInTransaction } from "~/server/db/transaction-context";
import { PBM_API_BASE, PBM_USER_AGENT } from "./config";
import { parseCatalog, parseLocation, parseMachineGroups } from "./parse";
import type {
  CatalogMachine,
  LocationSnapshot,
  MachineGroup,
  PbmAddMachineResult,
  PbmAuthResult,
  PbmCredentials,
  PbmToggleResult,
  PbmWriteFailure,
  PbmWriteFailureReason,
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
 * ERROR MODEL: PBM reports logical failures with HTTP 200 and an `errors` string
 * in the JSON body (e.g. `{"errors":"Failed to find machine"}`), NOT a 4xx — the
 * sole status-based exception is a disabled account (401 + `{"error":"..."}`).
 * So we classify success/failure from the body, never from `res.ok` alone.
 * Contract source: pinballmap/pbm spec (see docs/external/README.md).
 *
 * SECURITY: write/auth URLs carry credentials in the query string, so we never
 * log the full URL — only a redacted path label.
 */

const MAX_RETRY_AFTER_SECONDS = 5;

type WriteReason = PbmWriteFailureReason;

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

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

/** Parse a JSON body without throwing; null when absent or malformed. */
async function readBody(
  res: Response
): Promise<Record<string, unknown> | null> {
  try {
    return asRecord(await res.json());
  } catch {
    return null;
  }
}

/**
 * PBM puts logical-failure text in `errors` (HTTP 200) or `error` (the disabled
 * account 401). Returns that message, or null when the response is a success.
 */
function pbmErrorMessage(body: Record<string, unknown> | null): string | null {
  if (!body) return null;
  const raw = body["errors"] ?? body["error"];
  return typeof raw === "string" && raw.length > 0 ? raw : null;
}

/** Map a PBM error message (+status) to a write-failure reason. */
function writeReasonFor(status: number, message: string): WriteReason {
  const m = message.toLowerCase();
  if (m.includes("failed to find")) return "not_found";
  if (status === 401 || status === 403) return "unauthorized";
  if (m.includes("authentication is required") || m.includes("you can only")) {
    return "unauthorized";
  }
  return "rejected";
}

function writeFailure(reason: WriteReason, message?: string): PbmWriteFailure {
  return message === undefined
    ? { ok: false, reason }
    : { ok: false, reason, message };
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

type WriteOutcome =
  { ok: true; body: Record<string, unknown> | null } | PbmWriteFailure;

/**
 * Issue a write and classify the result from the body. Honors one 429 retry
 * within budget. A 200/201 with an `errors` field is a failure, not a success.
 */
async function writeRequest(
  method: "POST" | "PUT" | "DELETE",
  url: string,
  label: string
): Promise<WriteOutcome> {
  let res = await safeFetch(url, { method }, label);
  if (res.status === 429) {
    const retryAfter = parseRetryAfter(res);
    if (retryAfter > MAX_RETRY_AFTER_SECONDS) {
      log.warn(
        { retryAfter, label, action: "pinballmap.rateLimit" },
        "PinballMap retry-after exceeds inline budget"
      );
      return writeFailure("rate_limited");
    }
    await sleep(retryAfter * 1000);
    res = await safeFetch(url, { method }, label);
    if (res.status === 429) return writeFailure("rate_limited");
  }
  // Network error (599) or server error: retry later.
  if (res.status === 599 || res.status >= 500) return writeFailure("transient");

  const body = await readBody(res);
  const message = pbmErrorMessage(body);
  if (message)
    return writeFailure(writeReasonFor(res.status, message), message);

  // Defensive: a 4xx that didn't carry a PBM error body.
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      return writeFailure("unauthorized");
    }
    if (res.status === 404) return writeFailure("not_found");
    return writeFailure("transient");
  }
  return { ok: true, body };
}

function toWriteResult(outcome: WriteOutcome): PbmWriteResult {
  return outcome.ok ? { ok: true } : outcome;
}

async function readJson(path: string, label: string): Promise<unknown> {
  const res = await safeFetch(buildUrl(path), { method: "GET" }, label);
  if (!res.ok) {
    throw new Error(`PinballMap ${label} failed: HTTP ${res.status}`);
  }
  // A 200 with a non-JSON body (e.g. an HTML maintenance/edge page during an
  // outage) is a read failure, not a crash — surface it as a structured error.
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new Error(`PinballMap ${label} failed: response was not valid JSON`);
  }
  const message = pbmErrorMessage(asRecord(data));
  if (message) {
    throw new Error(`PinballMap ${label} failed: ${message}`);
  }
  return data;
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

    async fetchMachineGroups(): Promise<MachineGroup[]> {
      assertNotInTransaction("pinballmap.fetchMachineGroups");
      const raw = await readJson(`/machine_groups.json`, "fetchMachineGroups");
      return parseMachineGroups(raw);
    },

    async authDetails(login: string, password: string): Promise<PbmAuthResult> {
      assertNotInTransaction("pinballmap.authDetails");
      // Credentials in the query string — never log this URL.
      const url = buildUrl(`/users/auth_details.json`, { login, password });
      const res = await safeFetch(url, { method: "GET" }, "authDetails");
      if (res.status === 429) return { ok: false, reason: "rate_limited" };
      if (res.status === 599 || res.status >= 500) {
        return { ok: false, reason: "transient" };
      }
      const body = await readBody(res);
      const message = pbmErrorMessage(body);
      // Disabled account is the one status-based case: 401 + {"error":"..."}.
      if (res.status === 401) {
        return {
          ok: false,
          reason: "account_disabled",
          message: message ?? "account_disabled",
        };
      }
      // Everything else PBM rejects (wrong password, unknown user, unconfirmed)
      // comes back as HTTP 200 + {"errors":"..."}.
      if (message) {
        return { ok: false, reason: "invalid_credentials", message };
      }
      const token =
        typeof body?.["authentication_token"] === "string"
          ? body["authentication_token"]
          : null;
      if (!token) return { ok: false, reason: "transient" };
      const username =
        typeof body?.["username"] === "string" ? body["username"] : login;
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
        const outcome = await writeRequest("POST", url, "addMachine");
        if (!outcome.ok) return outcome;
        // Success body wraps the lmx: {"location_machine": {"id": ...}}.
        const lmx = asRecord(outcome.body?.["location_machine"]);
        const lmxId =
          typeof lmx?.["id"] === "number"
            ? lmx["id"]
            : typeof outcome.body?.["id"] === "number"
              ? outcome.body["id"]
              : null;
        if (lmxId === null) return writeFailure("transient");
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
        return toWriteResult(
          await writeRequest("DELETE", url, "removeMachine")
        );
      });
    },

    postCondition({ credentials, lmxId, comment }): Promise<PbmWriteResult> {
      assertNotInTransaction("pinballmap.postCondition");
      return serializeWrite(async () => {
        const url = buildUrl(
          `/location_machine_xrefs/${lmxId}.json`,
          credsQuery(credentials, { condition: comment })
        );
        return toWriteResult(await writeRequest("PUT", url, "postCondition"));
      });
    },

    toggleInsiderConnected({ credentials, lmxId }): Promise<PbmToggleResult> {
      assertNotInTransaction("pinballmap.toggleInsiderConnected");
      return serializeWrite(async () => {
        const url = buildUrl(
          `/location_machine_xrefs/${lmxId}/ic_toggle.json`,
          credsQuery(credentials)
        );
        const outcome = await writeRequest(
          "PUT",
          url,
          "toggleInsiderConnected"
        );
        if (!outcome.ok) return outcome;
        const lmx = asRecord(outcome.body?.["location_machine"]);
        const icEnabled =
          typeof lmx?.["ic_enabled"] === "boolean" ? lmx["ic_enabled"] : null;
        return { ok: true, icEnabled };
      });
    },

    confirmLineup({ credentials, locationId }): Promise<PbmWriteResult> {
      assertNotInTransaction("pinballmap.confirmLineup");
      return serializeWrite(async () => {
        const url = buildUrl(
          `/locations/${locationId}/confirm.json`,
          credsQuery(credentials)
        );
        return toWriteResult(await writeRequest("PUT", url, "confirmLineup"));
      });
    },
  };
}
