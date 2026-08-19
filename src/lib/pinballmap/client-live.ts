import "server-only";
import { log } from "~/lib/logger";
import { assertNotInTransaction } from "~/server/db/transaction-context";
import { PBM_API_BASE, PBM_USER_AGENT } from "./config";
import {
  parseCatalog,
  parseLocation,
  parseMachineGroups,
  parseRegionLmxes,
  parseRegionLocations,
} from "./parse";
import type {
  CatalogMachine,
  LocationSnapshot,
  MachineGroup,
  PbmRegionLmx,
  PbmRegionLocation,
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
 * - send the mandatory blanket `X-Api-Token` on EVERY request (reads + writes);
 *   PBM's `REQUIRE_API_TOKEN` gate flips on July 30 2026 (CORE-PBM-001, PP-uusr).
 *   The token is injected at construction (`createLiveClient(apiToken)`) — null
 *   until the integration is provisioned, in which case the header is omitted.
 * - writes ALSO append `user_email`/`user_token` (the per-operator identity) as
 *   query params — a distinct auth layer from the api_token access gate
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

/**
 * Region name as a URL path segment: lowercased, then percent-encoded.
 *
 * The lowercasing is a safety measure, not a cosmetic one. PBM's route constraint
 * matches region names case-insensitively, but the model scopes behind it do
 * `Region.find_by_name(name.downcase)` and handle a miss badly in two different
 * ways: `LocationMachineXref.region` returns nil, which leaves the relation
 * completely UNSCOPED (every xref on Earth), and `Location.region` silently falls
 * back to Portland. Either would poison a region diff. Callers normalize too;
 * doing it here as well means no future caller can reintroduce the bug.
 */
function regionSegment(region: string): string {
  return encodeURIComponent(region.trim().toLowerCase());
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
  label: string,
  apiToken: string | null
): Promise<Response> {
  try {
    return await fetch(url, {
      ...init,
      headers: {
        "User-Agent": PBM_USER_AGENT,
        // Mandatory blanket access gate on every request; omitted only while the
        // integration is unprovisioned (apiToken null). PP-uusr / CORE-PBM-001.
        ...(apiToken ? { "X-Api-Token": apiToken } : {}),
        ...(init.headers ?? {}),
      },
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
 *
 * **The TYPE of `errors` varies, and both shapes are live.** Real captures return
 * a bare string (`{"errors":"Failed to find machine"}`), while PBM's own request
 * specs build it as an array. We cannot control which one a given endpoint or a
 * future version sends, so this treats ANY present, non-empty `errors`/`error` as
 * an error regardless of type rather than pattern-matching one shape.
 *
 * That matters more than it looks. This function is the ONLY thing standing
 * between a 200-with-an-error-body and the caller treating it as data: a shape
 * this missed used to fall through to the parser, yield zero entries, and land in
 * the region job as an "empty payload" — a failed read wearing a successful run's
 * clothes. Unknown shapes therefore fail CLOSED with a generic message.
 */
function pbmErrorMessage(body: Record<string, unknown> | null): string | null {
  if (!body) return null;
  const raw = body["errors"] ?? body["error"];
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "string") return raw.length > 0 ? raw : null;
  if (Array.isArray(raw)) {
    // An empty array carries no complaint; treat it as success.
    if (raw.length === 0) return null;
    const joined = raw.filter((e) => typeof e === "string").join("; ");
    return joined.length > 0 ? joined : PBM_UNKNOWN_ERROR;
  }
  // `false` is the one non-string shape that means the OPPOSITE of an error:
  // `{"error": false, …}` is a common success idiom, and failing closed on it
  // would turn every good response from such an endpoint into a hard read
  // failure. `true` gets no such carve-out — that one really does signal an
  // error, just without a message.
  if (raw === false) return null;
  // An empty object carries no complaint, the same as an empty array: Rails
  // serializes `errors` as a hash and sends `{"errors":{}}` on a valid record,
  // so a present-but-empty object is success, not a failure. Failing closed on it
  // would turn every good response from such an endpoint into a hard write
  // failure (the symmetric bug to the empty-array carve-out above).
  if (
    typeof raw === "object" &&
    !Array.isArray(raw) &&
    Object.keys(raw).length === 0
  ) {
    return null;
  }
  // A non-empty object, a number, `true` — unrecognized, but PBM put something in
  // an error field and we must not read the body as data.
  return PBM_UNKNOWN_ERROR;
}

/** Stand-in when PBM signals an error in a shape we cannot render. */
const PBM_UNKNOWN_ERROR = "PinballMap reported an error";

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
  label: string,
  apiToken: string | null
): Promise<WriteOutcome> {
  let res = await safeFetch(url, { method }, label, apiToken);
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
    res = await safeFetch(url, { method }, label, apiToken);
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

async function readJson(
  path: string,
  label: string,
  apiToken: string | null,
  query?: Record<string, string>
): Promise<unknown> {
  const res = await safeFetch(
    buildUrl(path, query),
    { method: "GET" },
    label,
    apiToken
  );
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

/**
 * Build the live client. `apiToken` is PBM's mandatory blanket access gate
 * (X-Api-Token), injected once at construction and attached to every request;
 * null while the integration is unprovisioned (header omitted). PP-uusr.
 */
export function createLiveClient(apiToken: string | null): PinballMapClient {
  return {
    async fetchLocation(locationId: number): Promise<LocationSnapshot> {
      assertNotInTransaction("pinballmap.fetchLocation");
      const raw = await readJson(
        `/locations/${locationId}.json`,
        "fetchLocation",
        apiToken
      );
      return parseLocation(raw, new Date().toISOString());
    },

    async fetchCatalog(): Promise<CatalogMachine[]> {
      assertNotInTransaction("pinballmap.fetchCatalog");
      // Full payload (no `no_details`): that flag omits `ipdb_id`, which we
      // store on the machine record (vendored llms.txt §no_details).
      const raw = await readJson(`/machines.json`, "fetchCatalog", apiToken);
      return parseCatalog(raw);
    },

    async fetchRegionLmxes(region: string): Promise<PbmRegionLmx[]> {
      assertNotInTransaction("pinballmap.fetchRegionLmxes");
      // ONE bulk request for the whole region — the documented replacement for
      // looping over individual LMXes (vendored llms.txt §"Request Volume
      // Anti-Patterns"; this endpoint's own limit is 120/min, and the region job
      // spends one call an hour). Unpaginated: this returns every non-deleted xref in the
      // region. PBM also accepts `?limit=N`, which combined with their `id desc`
      // ordering yields the N most recent — deliberately NOT used, because a cap
      // would silently drop entries out of a diff that must see all of them.
      const raw = await readJson(
        `/region/${regionSegment(region)}/location_machine_xrefs.json`,
        "fetchRegionLmxes",
        apiToken
      );
      return parseRegionLmxes(raw);
    },

    async fetchRegionLocations(region: string): Promise<PbmRegionLocation[]> {
      assertNotInTransaction("pinballmap.fetchRegionLocations");
      // `no_details=1` strips the HEAVY NESTED content (the machine list, the
      // conditions, the description) — not the scalar columns. Each row still
      // arrives with ~20 fields (city, lat/lon, machine_count, …); we read `id`
      // and `name` and ignore the rest, which is all the alert needs to label a
      // venue. Measured against the real Austin response 2026-08-17. One request
      // for the whole region; never a per-location lookup.
      const raw = await readJson(
        `/region/${regionSegment(region)}/locations.json`,
        "fetchRegionLocations",
        apiToken,
        { no_details: "1" }
      );
      return parseRegionLocations(raw);
    },

    async fetchMachineGroups(): Promise<MachineGroup[]> {
      assertNotInTransaction("pinballmap.fetchMachineGroups");
      const raw = await readJson(
        `/machine_groups.json`,
        "fetchMachineGroups",
        apiToken
      );
      return parseMachineGroups(raw);
    },

    async authDetails(login: string, password: string): Promise<PbmAuthResult> {
      assertNotInTransaction("pinballmap.authDetails");
      // Credentials in the query string — never log this URL.
      const url = buildUrl(`/users/auth_details.json`, { login, password });
      const res = await safeFetch(
        url,
        { method: "GET" },
        "authDetails",
        apiToken
      );
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
        const outcome = await writeRequest("POST", url, "addMachine", apiToken);
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
          await writeRequest("DELETE", url, "removeMachine", apiToken)
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
        return toWriteResult(
          await writeRequest("PUT", url, "postCondition", apiToken)
        );
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
          "toggleInsiderConnected",
          apiToken
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
        return toWriteResult(
          await writeRequest("PUT", url, "confirmLineup", apiToken)
        );
      });
    },
  };
}
