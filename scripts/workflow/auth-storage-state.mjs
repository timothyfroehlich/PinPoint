/**
 * Freshness check for a Playwright storage-state file's Supabase session.
 *
 * pr-screenshots.mjs reuses saved auth (e2e/.auth/<role>.json) so it doesn't
 * reset+reseed the local DB on every run. The original check only asked whether
 * the file EXISTS — not whether the session inside is still valid. So an expired
 * token passed the check, the browser was handed a dead cookie, and the script
 * silently captured a logged-out / redirected page instead of the real one
 * (PP-chhn.1: observed on PR #1697, where a member token had expired the day
 * before). "Silently wrong output" is the worst failure mode for a screenshot
 * tool, so treat a stale session exactly like a missing file: regenerate.
 *
 * Why decode the token rather than read the cookie's own expiry: Supabase
 * (@supabase/ssr) sets the auth cookie's Max-Age far into the future so the
 * cookie itself survives — the session lifetime lives in the *access token*, not
 * the cookie envelope. The Playwright `cookie.expires` field therefore says
 * nothing about whether the login is still good; only the token payload does.
 */

import { readFileSync } from "node:fs";

// @supabase/ssr writes the session under a cookie (or localStorage key) named
// `sb-<project-ref>-auth-token`. When the value exceeds the per-cookie size
// ceiling it is split into `.0`, `.1`, … chunks under the same base name; small
// sessions stay in a single unchunked cookie. Match both shapes.
const AUTH_TOKEN_NAME_RE = /^sb-.+-auth-token(?:\.(\d+))?$/;

// @supabase/ssr prefixes an encoded cookie value with this marker; the remainder
// is base64url of the JSON session.
const BASE64_PREFIX = "base64-";

/** Base64url or standard base64 → decoded UTF-8 string, or null on failure. */
function decodeBase64(value) {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    return Buffer.from(normalized, "base64").toString("utf8");
  } catch {
    return null;
  }
}

/** A JWT's `exp` claim (epoch seconds), or null if it isn't a decodable JWT. */
function jwtExp(token) {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const payloadJson = decodeBase64(parts[1]);
  if (payloadJson === null) return null;
  try {
    const payload = JSON.parse(payloadJson);
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

/**
 * Decode one reassembled auth-token value to the session's expiry in epoch
 * seconds. Prefers the session object's own `expires_at`; falls back to the
 * access-token JWT's `exp`. Returns null when nothing decodable is found.
 */
function expiryFromTokenValue(rawValue) {
  if (typeof rawValue !== "string" || rawValue.length === 0) return null;

  let body = rawValue;
  if (body.startsWith(BASE64_PREFIX)) {
    const decoded = decodeBase64(body.slice(BASE64_PREFIX.length));
    if (decoded === null) return null;
    body = decoded;
  }

  try {
    const parsed = JSON.parse(body);
    if (parsed && typeof parsed === "object") {
      if (typeof parsed.expires_at === "number") return parsed.expires_at;
      if (typeof parsed.access_token === "string") {
        return jwtExp(parsed.access_token);
      }
    }
  } catch {
    // Not JSON — the value may itself be a bare JWT.
    return jwtExp(body);
  }
  return null;
}

/**
 * Reassemble every Supabase auth-token value in a Playwright storage-state
 * object, joining chunked cookies (`<name>.0`, `<name>.1`, …) back into the
 * single value they were split from. Scans both cookies and localStorage.
 * @param {{cookies?: Array, origins?: Array}} storageState
 * @returns {string[]} one reassembled value per auth-token group
 */
function reassembleAuthTokens(storageState) {
  /** @type {Array<{name: string, value: string}>} */
  const entries = [];

  for (const cookie of storageState?.cookies ?? []) {
    if (cookie && typeof cookie.name === "string") {
      entries.push({ name: cookie.name, value: String(cookie.value ?? "") });
    }
  }
  for (const origin of storageState?.origins ?? []) {
    for (const item of origin?.localStorage ?? []) {
      if (item && typeof item.name === "string") {
        entries.push({ name: item.name, value: String(item.value ?? "") });
      }
    }
  }

  // Group by base name (chunk suffix stripped), ordering chunks numerically
  // before concatenation. -1 sorts the unchunked entry first; the SDK never
  // writes chunked and unchunked forms for the same key simultaneously.
  const groups = new Map();
  for (const entry of entries) {
    const match = AUTH_TOKEN_NAME_RE.exec(entry.name);
    if (!match) continue;
    const base = entry.name.replace(/\.\d+$/, "");
    const chunkIndex = match[1] === undefined ? -1 : Number(match[1]);
    if (!groups.has(base)) groups.set(base, []);
    groups.get(base).push({ chunkIndex, value: entry.value });
  }

  return [...groups.values()].map((parts) => {
    parts.sort((a, b) => a.chunkIndex - b.chunkIndex);
    return parts.map((p) => p.value).join("");
  });
}

/**
 * The latest session expiry (epoch seconds) found in a parsed storage-state
 * object, or null if it carries no decodable Supabase auth token. When several
 * tokens are present the most-distant expiry wins — the point is "is any usable
 * session here", and forcing regeneration off a stale leftover would waste a DB
 * reset.
 * @param {{cookies?: Array, origins?: Array}} storageState
 */
export function readStorageStateExpiry(storageState) {
  let latest = null;
  for (const value of reassembleAuthTokens(storageState)) {
    const exp = expiryFromTokenValue(value);
    if (exp !== null && (latest === null || exp > latest)) latest = exp;
  }
  return latest;
}

/**
 * Decide whether a storage-state file still holds a usable Supabase session.
 * A missing/corrupt file, a file with no auth token, and an expired or
 * about-to-expire session all resolve to `fresh: false` so the caller
 * regenerates rather than shooting a logged-out page.
 *
 * @param {string} path storage-state file path
 * @param {{ now?: number, bufferSeconds?: number }} [opts]
 *   `now` is epoch ms (default Date.now()); `bufferSeconds` treats a session
 *   expiring within that many seconds as already stale (default 60), so a token
 *   doesn't die mid-run across a multi-page capture.
 * @returns {{ fresh: boolean, reason: string, expiresAt: number|null }}
 */
export function evaluateStorageState(
  path,
  { now = Date.now(), bufferSeconds = 60 } = {}
) {
  let storageState;
  try {
    storageState = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return { fresh: false, reason: "missing or unreadable", expiresAt: null };
  }

  const expiresAt = readStorageStateExpiry(storageState);
  if (expiresAt === null) {
    return {
      fresh: false,
      reason: "no decodable Supabase session",
      expiresAt: null,
    };
  }

  const cutoff = now / 1000 + bufferSeconds;
  if (expiresAt <= now / 1000) {
    return { fresh: false, reason: "session expired", expiresAt };
  }
  if (expiresAt <= cutoff) {
    return {
      fresh: false,
      reason: "session expires within a minute",
      expiresAt,
    };
  }
  return { fresh: true, reason: "session valid", expiresAt };
}
