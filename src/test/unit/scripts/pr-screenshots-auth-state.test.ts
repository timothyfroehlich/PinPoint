// Freshness detection for pr-screenshots.mjs's reused auth storage state
// (PP-chhn.1). The bug it guards against: the script logged "auth present" and
// reused e2e/.auth/<role>.json whenever the file merely existed, so an expired
// Supabase session sailed through and the browser was handed a dead cookie —
// producing a screenshot of a logged-out/redirected page that looked plausible.
//
// These are pure decode/expiry tests. They construct storage-state objects the
// exact way @supabase/ssr writes them (base64url of the JSON session behind a
// `base64-` prefix, optionally split into `.0`/`.1` chunks) so the parser is
// pinned to the real cookie format, not a paraphrase of it.

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import {
  evaluateStorageState,
  readStorageStateExpiry,
} from "../../../../scripts/workflow/auth-storage-state.mjs";

const NOW_MS = 1_700_000_000_000; // fixed clock so "near expiry" is deterministic
const NOW_S = NOW_MS / 1000;

/** Encode a session object the way @supabase/ssr stores it in a cookie value. */
function encodeSession(session: unknown): string {
  return "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
}

/** A minimal fake JWT carrying just an `exp` claim (epoch seconds). */
function fakeJwt(exp: number): string {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ exp })}.signature`;
}

function cookieState(value: string, name = "sb-abcdefgh-auth-token") {
  return {
    cookies: [
      { name, value, domain: "localhost", path: "/", expires: NOW_S + 4e7 },
    ],
    origins: [],
  };
}

const tmpDirs: string[] = [];
function writeStateFile(state: unknown): string {
  const dir = mkdtempSync(path.join(tmpdir(), "pr-shots-auth-"));
  tmpDirs.push(dir);
  const file = path.join(dir, "member.json");
  writeFileSync(file, JSON.stringify(state));
  return file;
}

afterAll(() => {
  for (const dir of tmpDirs) rmSync(dir, { recursive: true, force: true });
});

describe("readStorageStateExpiry — decoding the Supabase session", () => {
  it("reads expires_at from a base64- prefixed cookie", () => {
    const exp = NOW_S + 3600;
    const state = cookieState(
      encodeSession({ access_token: "t", expires_at: exp })
    );
    expect(readStorageStateExpiry(state)).toBe(exp);
  });

  it("reads a plain (non-base64) JSON cookie value", () => {
    const exp = NOW_S + 3600;
    const state = cookieState(JSON.stringify({ expires_at: exp }));
    expect(readStorageStateExpiry(state)).toBe(exp);
  });

  it("reassembles .0/.1 chunked cookies before decoding", () => {
    const exp = NOW_S + 3600;
    const full = encodeSession({ access_token: "t", expires_at: exp });
    const mid = Math.floor(full.length / 2);
    const state = {
      cookies: [
        { name: "sb-abcdefgh-auth-token.1", value: full.slice(mid) },
        { name: "sb-abcdefgh-auth-token.0", value: full.slice(0, mid) },
      ],
      origins: [],
    };
    expect(readStorageStateExpiry(state)).toBe(exp);
  });

  it("finds a token stored in localStorage", () => {
    const exp = NOW_S + 3600;
    const state = {
      cookies: [],
      origins: [
        {
          origin: "http://localhost:3000",
          localStorage: [
            {
              name: "sb-abcdefgh-auth-token",
              value: encodeSession({ expires_at: exp }),
            },
          ],
        },
      ],
    };
    expect(readStorageStateExpiry(state)).toBe(exp);
  });

  it("falls back to the access-token JWT exp when expires_at is absent", () => {
    const exp = NOW_S + 3600;
    const state = cookieState(encodeSession({ access_token: fakeJwt(exp) }));
    expect(readStorageStateExpiry(state)).toBe(exp);
  });

  it("returns null when no Supabase auth token is present", () => {
    const state = {
      cookies: [{ name: "unrelated-cookie", value: "x" }],
      origins: [],
    };
    expect(readStorageStateExpiry(state)).toBeNull();
  });

  it("returns the most-distant expiry when multiple tokens exist", () => {
    const near = NOW_S + 100;
    const far = NOW_S + 10000;
    const state = {
      cookies: [
        {
          name: "sb-proja-auth-token",
          value: encodeSession({ expires_at: near }),
        },
        {
          name: "sb-projb-auth-token",
          value: encodeSession({ expires_at: far }),
        },
      ],
      origins: [],
    };
    expect(readStorageStateExpiry(state)).toBe(far);
  });
});

describe("evaluateStorageState — freshness verdict", () => {
  const opts = { now: NOW_MS, bufferSeconds: 60 };

  it("is fresh for a session comfortably in the future", () => {
    const file = writeStateFile(
      cookieState(encodeSession({ expires_at: NOW_S + 3600 }))
    );
    expect(evaluateStorageState(file, opts)).toMatchObject({
      fresh: true,
      expiresAt: NOW_S + 3600,
    });
  });

  it("is stale for an expired session even when the cookie itself is long-lived", () => {
    // The exact real-world failure: cookie envelope valid for weeks, token dead.
    const file = writeStateFile(
      cookieState(encodeSession({ expires_at: NOW_S - 10 }))
    );
    const result = evaluateStorageState(file, opts);
    expect(result.fresh).toBe(false);
    expect(result.reason).toBe("session expired");
  });

  it("is stale for a session expiring inside the buffer window", () => {
    const file = writeStateFile(
      cookieState(encodeSession({ expires_at: NOW_S + 30 }))
    );
    const result = evaluateStorageState(file, opts);
    expect(result.fresh).toBe(false);
    expect(result.reason).toBe("session expires within a minute");
  });

  it("is stale (not a crash) for a missing file", () => {
    const result = evaluateStorageState(
      path.join(tmpdir(), "does-not-exist-pr-shots.json"),
      opts
    );
    expect(result.fresh).toBe(false);
    expect(result.reason).toBe("missing or unreadable");
  });

  it("is stale for a corrupt (non-JSON) file", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "pr-shots-auth-"));
    tmpDirs.push(dir);
    const file = path.join(dir, "member.json");
    writeFileSync(file, "not json {");
    const result = evaluateStorageState(file, opts);
    expect(result.fresh).toBe(false);
    expect(result.reason).toBe("missing or unreadable");
  });

  it("is stale for a file with no decodable session", () => {
    const file = writeStateFile({
      cookies: [{ name: "other", value: "x" }],
      origins: [],
    });
    const result = evaluateStorageState(file, opts);
    expect(result.fresh).toBe(false);
    expect(result.reason).toBe("no decodable Supabase session");
  });
});
