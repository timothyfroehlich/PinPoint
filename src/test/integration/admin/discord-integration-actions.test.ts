/**
 * Integration tests for the admin Discord integration actions.
 *
 * Covers:
 *   - saveDiscordConfig: auth gate, schema validation, probeBotToken happy/failure
 *     paths, probeServerMembership happy/failure paths, DB write path
 *   - validateBotToken: happy path + not-configured
 *   - validateServerId: happy path + invalid-input + not-member
 *
 * These tests replace the class-J-latent e2e/full/admin-discord-integration.spec.ts.
 * They exercise the real action wiring (auth check → schema parse → Discord probe → DB)
 * while mocking only the three SDK boundaries that reach out of the process:
 *   1. `~/lib/supabase/server`  — Supabase auth client
 *   2. `~/lib/discord/config`   — Vault token accessor
 *   3. `globalThis.fetch`       — Discord REST API (probeBotToken / probeServerMembership)
 *
 * The DB layer (`~/server/db`) is mocked with vi.fn() chains because the
 * saveDiscordConfig action calls Vault SQL functions (vault.create_secret,
 * vault.update_secret) that cannot run in PGlite.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { randomUUID } from "node:crypto";

// ── Module mocks (hoisted) ────────────────────────────────────────────────────

const {
  mockExecute,
  mockReturning,
  mockUpdateSet,
  mockUpdate,
  mockFindFirst,
  mockTransaction,
  mockFindFirstProfile,
} = vi.hoisted(() => {
  const mockExecute = vi.fn().mockResolvedValue([]);
  const mockReturning = vi.fn().mockResolvedValue([{ id: "singleton" }]);
  const mockUpdateWhere = vi.fn(() => ({ returning: mockReturning }));
  const mockUpdateSet = vi.fn(
    (_payload: {
      botTokenVaultId?: string | null;
      guildId?: string | null;
      botHealthStatus?: string;
      lastBotCheckAt?: Date | null;
    }) => ({
      where: mockUpdateWhere,
    })
  );
  const mockUpdate = vi.fn(() => ({ set: mockUpdateSet }));
  const mockFindFirst = vi
    .fn()
    .mockResolvedValue({ botTokenVaultId: "existing-vault-id" });
  const mockFindFirstProfile = vi.fn().mockResolvedValue({ role: "admin" });

  interface Tx {
    query: { discordIntegrationConfig: { findFirst: typeof mockFindFirst } };
    update: typeof mockUpdate;
    execute: typeof mockExecute;
  }
  const mockTransaction = vi.fn((callback: (tx: Tx) => unknown) =>
    callback({
      query: { discordIntegrationConfig: { findFirst: mockFindFirst } },
      update: mockUpdate,
      execute: mockExecute,
    })
  );

  return {
    mockExecute,
    mockReturning,
    mockUpdateWhere,
    mockUpdateSet,
    mockUpdate,
    mockFindFirst,
    mockTransaction,
    mockFindFirstProfile,
  };
});

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("~/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

// Mock the entire discord/config module so no Supabase-Vault RPC fires.
vi.mock("~/lib/discord/config", () => ({
  getDiscordTokenForAdmin: vi.fn(),
  getDiscordConfig: vi.fn(),
  isDiscordIntegrationConfigured: vi.fn(),
}));

vi.mock("~/lib/observability/report-error", () => ({
  reportError: vi.fn(),
}));

vi.mock("~/server/db", () => ({
  db: {
    transaction: mockTransaction,
    query: {
      userProfiles: { findFirst: mockFindFirstProfile },
      discordIntegrationConfig: { findFirst: mockFindFirst },
    },
    update: mockUpdate,
    execute: mockExecute,
  },
}));

// ── Import the actions under test (after mocks are registered) ────────────────

import {
  clearDiscordBotTokenAction,
  saveDiscordConfig,
  validateBotToken,
  validateServerId,
} from "~/app/(app)/admin/integrations/discord/actions";
import { createClient } from "~/lib/supabase/server";
import { getDiscordTokenForAdmin } from "~/lib/discord/config";
import { reportError } from "~/lib/observability/report-error";

// ── Helpers ───────────────────────────────────────────────────────────────────

const ORIGINAL_FETCH = globalThis.fetch;

/** Replace globalThis.fetch with a handler that returns canned responses. */
function mockFetch(
  handler: (url: string, init?: RequestInit) => Response | Promise<Response>
): void {
  globalThis.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    let url: string;
    if (typeof input === "string") {
      url = input;
    } else if (input instanceof URL) {
      url = input.href;
    } else {
      url = input.url;
    }
    return Promise.resolve(handler(url, init));
  });
}

interface FormDataOverrides {
  newToken?: string;
  guildId?: string;
  inviteLink?: string;
}

/** Build a FormData for saveDiscordConfig with sensible defaults. */
function makeFormData(overrides: FormDataOverrides = {}): FormData {
  const fd = new FormData();
  fd.set("newToken", overrides.newToken ?? "");
  fd.set("guildId", overrides.guildId ?? "123456789012345678");
  fd.set("inviteLink", overrides.inviteLink ?? "");
  return fd;
}

const ADMIN_USER_ID = randomUUID();
const VALID_TOKEN =
  "Bot.Token.1234567890123456789012345678901234567890123456789012345678";

// ── Test setup ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  // Default: Stub global fetch to throw by default to prevent silent network hits in tests.
  globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    throw new Error(`fetch was called with unmocked URL: ${url}`);
  });

  // Default: auth resolves to an admin user.
  const mockSupabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: ADMIN_USER_ID } },
        error: null,
      }),
    },
  };
  vi.mocked(createClient).mockResolvedValue(
    mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>
  );

  // Default: admin role found in profiles.
  mockFindFirstProfile.mockResolvedValue({ role: "admin" });

  // Default: no saved vault token (clean integration baseline).
  vi.mocked(getDiscordTokenForAdmin).mockResolvedValue(null);

  // Default: existing singleton row has a vault id (token-rotation path).
  mockFindFirst.mockResolvedValue({ botTokenVaultId: "existing-vault-id" });

  // Token saves create a replacement secret; cleanup DELETEs return no rows.
  mockExecute.mockImplementation((query) =>
    JSON.stringify(query).includes("create_secret")
      ? Promise.resolve([{ id: "new-vault-id" }])
      : Promise.resolve([])
  );
  mockReturning.mockResolvedValue([{ id: "singleton" }]);
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

// ── saveDiscordConfig ─────────────────────────────────────────────────────────

describe("saveDiscordConfig", () => {
  describe("auth + permission gate", () => {
    it("throws Unauthorized when no user is authenticated", async () => {
      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: null,
          }),
        },
      } as unknown as Awaited<ReturnType<typeof createClient>>);

      await expect(saveDiscordConfig(makeFormData())).rejects.toThrow(
        "Unauthorized"
      );
    });

    it("throws Forbidden when user is a member (not admin)", async () => {
      mockFindFirstProfile.mockResolvedValue({ role: "member" });

      await expect(saveDiscordConfig(makeFormData())).rejects.toThrow(
        "Forbidden"
      );
    });
  });

  describe("schema validation", () => {
    it("allows an empty guildId to turn notifications off", async () => {
      const fd = makeFormData({ guildId: "" });
      const result = await saveDiscordConfig(fd);
      expect(result.ok).toBe(true);
      expect(globalThis.fetch).not.toHaveBeenCalled();
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          guildId: null,
          botHealthStatus: "unknown",
          lastBotCheckAt: null,
        })
      );
    });

    it("returns field error for non-numeric guildId", async () => {
      const fd = makeFormData({ guildId: "not-a-number" });
      const result = await saveDiscordConfig(fd);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => e.field === "guildId")).toBe(true);
      }
    });

    it("returns field error for too-short token", async () => {
      const fd = makeFormData({ newToken: "short" });
      const result = await saveDiscordConfig(fd);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => e.field === "newToken")).toBe(true);
      }
    });
  });

  describe("unconfigured save (no Discord probes required)", () => {
    it("saves successfully when the server ID is empty", async () => {
      // No fetch mock needed — server membership is irrelevant while the
      // notification integration is unconfigured.
      const fd = makeFormData({
        newToken: "",
        guildId: "",
      });
      const result = await saveDiscordConfig(fd);
      expect(result.ok).toBe(true);
    });
  });

  describe("configured save — probeBotToken outcomes", () => {
    it("returns ok:true when token is valid and bot is in the server (happy path)", async () => {
      mockFetch((url) => {
        if (url.includes("/users/@me")) {
          return new Response(JSON.stringify({ username: "TestBot" }), {
            status: 200,
          });
        }
        // probeServerMembership
        return new Response(JSON.stringify({ name: "Test Guild" }), {
          status: 200,
        });
      });

      const fd = makeFormData({
        newToken: VALID_TOKEN,
        guildId: "123456789012345678",
      });
      const result = await saveDiscordConfig(fd);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.botUsername).toBe("TestBot");
      }
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ guildId: "123456789012345678" })
      );

      // Assert that fetch was called as expected (method + auth header)
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);

      const [firstUrl, firstInit] = vi.mocked(globalThis.fetch).mock.calls[0];
      expect(firstUrl).toBe("https://discord.com/api/v10/users/@me");
      expect(firstInit?.method ?? "GET").toBe("GET");
      expect(firstInit?.headers).toEqual({
        Authorization: `Bot ${VALID_TOKEN}`,
      });

      const [secondUrl, secondInit] = vi.mocked(globalThis.fetch).mock.calls[1];
      expect(secondUrl).toBe(
        "https://discord.com/api/v10/guilds/123456789012345678"
      );
      expect(secondInit?.method ?? "GET").toBe("GET");
      expect(secondInit?.headers).toEqual({
        Authorization: `Bot ${VALID_TOKEN}`,
      });
    });

    it("returns newToken field error when token is rejected by Discord (401)", async () => {
      mockFetch(() => new Response("{}", { status: 401 }));

      const fd = makeFormData({
        newToken: VALID_TOKEN,
        guildId: "123456789012345678",
      });
      const result = await saveDiscordConfig(fd);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => e.field === "newToken")).toBe(true);
        expect(result.errors[0]?.message).toMatch(/rejected/i);
      }
    });

    it("returns newToken field error when token is a transient failure", async () => {
      mockFetch(() => new Response("{}", { status: 503 }));

      const fd = makeFormData({
        newToken: VALID_TOKEN,
        guildId: "123456789012345678",
      });
      const result = await saveDiscordConfig(fd);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => e.field === "newToken")).toBe(true);
        expect(result.errors[0]?.message).toMatch(/didn't respond/i);
      }
    });
  });

  describe("configured save — probeServerMembership outcomes", () => {
    it("fails closed when the saved Vault token cannot be loaded", async () => {
      vi.mocked(getDiscordTokenForAdmin).mockRejectedValue(
        new Error("Vault unavailable")
      );

      const result = await saveDiscordConfig(
        makeFormData({ newToken: "", guildId: "123456789012345678" })
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toEqual([
          expect.objectContaining({
            field: "newToken",
            message: expect.stringMatching(/couldn't read/i),
          }),
        ]);
      }
      expect(globalThis.fetch).not.toHaveBeenCalled();
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it("returns guildId field error when bot is not in the server (404)", async () => {
      mockFetch((url) => {
        if (url.includes("/users/@me")) {
          return new Response(JSON.stringify({ username: "TestBot" }), {
            status: 200,
          });
        }
        // Guild probe → 404 means bot not a member
        return new Response("{}", { status: 404 });
      });

      const fd = makeFormData({
        newToken: VALID_TOKEN,
        guildId: "123456789012345678",
      });
      const result = await saveDiscordConfig(fd);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => e.field === "guildId")).toBe(true);
        expect(result.errors[0]?.message).toMatch(/isn't a member/i);
      }
    });

    it("returns newToken field error when saved token is rejected during server probe (401)", async () => {
      // Simulates: no new token typed (rotation skipped), but saved token is
      // broken — Discord returns 401 on the guild probe.
      vi.mocked(getDiscordTokenForAdmin).mockResolvedValue(VALID_TOKEN);

      mockFetch(() => new Response("{}", { status: 401 }));

      const fd = makeFormData({
        newToken: "", // no rotation — uses saved token
        guildId: "123456789012345678",
      });
      const result = await saveDiscordConfig(fd);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => e.field === "newToken")).toBe(true);
      }
    });
  });

  describe("partial configuration — no token configured", () => {
    it("saves the server ID without treating the integration as configured", async () => {
      vi.mocked(getDiscordTokenForAdmin).mockResolvedValue(null);
      mockFindFirst.mockResolvedValue({ botTokenVaultId: null });

      const fd = makeFormData({
        newToken: "",
        guildId: "123456789012345678",
      });
      const result = await saveDiscordConfig(fd);
      expect(result.ok).toBe(true);
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ guildId: "123456789012345678" })
      );
    });
  });

  // ── CORE-ARCH-011: Vault RPCs run OUTSIDE the db.transaction ──────────────
  describe("vault writes are non-transactional (CORE-ARCH-011)", () => {
    /** Stub Discord probes so a token-rotation save reaches persistence. */
    function mockHappyProbes(): void {
      mockFetch((url) => {
        if (url.includes("/users/@me")) {
          return new Response(JSON.stringify({ username: "TestBot" }), {
            status: 200,
          });
        }
        return new Response(JSON.stringify({ name: "Test Guild" }), {
          status: 200,
        });
      });
    }

    it("rotation creates a replacement before atomically swapping the pointer", async () => {
      mockHappyProbes();
      mockFindFirst.mockResolvedValue({ botTokenVaultId: "existing-vault-id" });

      // Record call order across the vault RPC and the transaction.
      const order: string[] = [];
      mockExecute.mockImplementation(() => {
        order.push("execute");
        return Promise.resolve([{ id: "replacement-vault-id" }]);
      });
      mockTransaction.mockImplementation((callback) => {
        order.push("transaction");
        return callback({
          query: { discordIntegrationConfig: { findFirst: mockFindFirst } },
          update: mockUpdate,
          execute: mockExecute,
        });
      });

      const fd = makeFormData({
        newToken: VALID_TOKEN,
        guildId: "123456789012345678",
      });
      const result = await saveDiscordConfig(fd);
      expect(result.ok).toBe(true);

      // create_secret ran before the pointer-swap transaction. Cleanup of the
      // replaced secret happens only after the transaction commits.
      expect(JSON.stringify(mockExecute.mock.calls[0]?.[0])).toContain(
        "create_secret"
      );
      expect(order.slice(0, 2)).toEqual(["execute", "transaction"]);
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ botTokenVaultId: "replacement-vault-id" })
      );
    });

    it("create path: creates the secret pre-transaction, then writes botTokenVaultId inside the transaction", async () => {
      mockHappyProbes();
      // No existing vault id → create path.
      mockFindFirst.mockResolvedValue({ botTokenVaultId: null });
      mockExecute.mockResolvedValue([{ id: "new-vault-id" }]);

      const fd = makeFormData({
        newToken: VALID_TOKEN,
        guildId: "123456789012345678",
      });
      const result = await saveDiscordConfig(fd);
      expect(result.ok).toBe(true);

      // create_secret ran on the main connection.
      expect(mockExecute).toHaveBeenCalledTimes(1);
      const sqlArg = mockExecute.mock.calls[0]?.[0];
      expect(JSON.stringify(sqlArg)).toContain("create_secret");

      // The singleton row was pointed at the new vault id with the
      // race-guard set (botTokenVaultId present in the .set() payload).
      const setPayloads = mockUpdateSet.mock.calls.map((c) => c[0]);
      expect(
        setPayloads.some((p) => p.botTokenVaultId === "new-vault-id")
      ).toBe(true);
    });

    // The orphan-compensation cases deliberately do NOT live here. They used to,
    // asserted as `JSON.stringify(sqlArg).includes("delete_secret")` — a test
    // that inspects the SQL string the action generates without ever running
    // it. That let a compensation calling a function supabase_vault does not
    // ship pass review and ship (PP-w3d9). They now live in
    // src/test/integration/admin/discord-vault-orphan-cleanup.test.ts, which
    // executes every statement against Postgres and asserts on the surviving
    // vault.secrets rows instead.

    it("vault RPC rejection returns {ok:false} and reports to Sentry instead of throwing uncaught", async () => {
      mockHappyProbes();
      mockFindFirst.mockResolvedValue({ botTokenVaultId: "existing-vault-id" });

      // Vault is down: the pre-transaction vault.create_secret rejects.
      // This call now lives inside the action's try, so the failure must be
      // caught and surfaced as a structured error — not escape to Next.js's
      // generic server-action error boundary.
      mockExecute.mockRejectedValue(new Error("vault unavailable"));

      const fd = makeFormData({
        newToken: VALID_TOKEN,
        guildId: "123456789012345678",
      });

      // Must not throw.
      const result = await saveDiscordConfig(fd);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => e.field === "guildId")).toBe(true);
      }

      // Sentry signal preserved.
      expect(reportError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ action: "saveDiscordConfig" })
      );

      // The transaction never opened (vault RPC failed first).
      expect(mockTransaction).not.toHaveBeenCalled();
    });
  });
});

describe("clearDiscordBotTokenAction", () => {
  it("returns a structured error when the token pointer cannot be read", async () => {
    mockFindFirst.mockRejectedValue(new Error("database unavailable"));

    const result = await clearDiscordBotTokenAction();

    expect(result).toEqual({
      ok: false,
      message: "Failed to remove the token. Try again.",
    });
    expect(reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ action: "clearDiscordBotToken.read" })
    );
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("unlinks the exact saved token, resets health, and deletes its Vault row", async () => {
    mockFindFirst.mockResolvedValue({ botTokenVaultId: "existing-vault-id" });

    const result = await clearDiscordBotTokenAction();

    expect(result).toEqual({ ok: true });
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        botTokenVaultId: null,
        botHealthStatus: "unknown",
        lastBotCheckAt: null,
      })
    );
    expect(JSON.stringify(mockExecute.mock.calls[0]?.[0])).toContain(
      "vault.secrets"
    );
  });

  it("does not delete when a concurrent rotation wins the guarded unlink", async () => {
    mockFindFirst.mockResolvedValue({ botTokenVaultId: "existing-vault-id" });
    mockReturning.mockResolvedValue([]);

    const result = await clearDiscordBotTokenAction();

    expect(result).toEqual({
      ok: false,
      message: "The saved token changed. Refresh and try again.",
    });
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("remains off when best-effort Vault cleanup fails", async () => {
    mockFindFirst.mockResolvedValue({ botTokenVaultId: "existing-vault-id" });
    mockExecute.mockRejectedValue(new Error("vault unavailable"));

    const result = await clearDiscordBotTokenAction();

    expect(result).toEqual({ ok: true });
    expect(reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        action: "clearDiscordBotToken.vaultCleanup",
        bestEffort: true,
      })
    );
  });

  it("is idempotent when no token is saved", async () => {
    mockFindFirst.mockResolvedValue({ botTokenVaultId: null });

    const result = await clearDiscordBotTokenAction();

    expect(result).toEqual({ ok: true });
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        botHealthStatus: "unknown",
        lastBotCheckAt: null,
      })
    );
    expect(mockExecute).not.toHaveBeenCalled();
  });
});

// ── validateBotToken ──────────────────────────────────────────────────────────

describe("validateBotToken", () => {
  it("returns ok:true with botUsername when Discord confirms the token", async () => {
    vi.mocked(getDiscordTokenForAdmin).mockResolvedValue(VALID_TOKEN);

    mockFetch(
      () => new Response(JSON.stringify({ username: "MyBot" }), { status: 200 })
    );

    const fd = new FormData();
    fd.set("newToken", "");
    const result = await validateBotToken(fd);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.botUsername).toBe("MyBot");
    }

    // Assert that fetch was called as expected
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(url).toBe("https://discord.com/api/v10/users/@me");
    expect(init?.method ?? "GET").toBe("GET");
    expect(init?.headers).toEqual({
      Authorization: `Bot ${VALID_TOKEN}`,
    });
  });

  it("returns not_configured when no token is available in form or DB", async () => {
    vi.mocked(getDiscordTokenForAdmin).mockResolvedValue(null);

    const fd = new FormData();
    fd.set("newToken", "");
    const result = await validateBotToken(fd);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("not_configured");
    }
  });

  it("returns invalid_token when Discord returns 401", async () => {
    vi.mocked(getDiscordTokenForAdmin).mockResolvedValue(VALID_TOKEN);
    mockFetch(() => new Response("{}", { status: 401 }));

    const fd = new FormData();
    fd.set("newToken", "");
    const result = await validateBotToken(fd);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("invalid_token");
    }
  });
});

// ── validateServerId ──────────────────────────────────────────────────────────

describe("validateServerId", () => {
  it("returns ok:true with guildName when bot is in the server", async () => {
    // Supply the token via the form field so resolveTokenForValidation returns it
    // without needing getDiscordTokenForAdmin (avoids the null default).
    // Note: validateServerId reads the "guildId" form field (not "serverId") for
    // the server id — this matches how the form submits the data.
    mockFetch(
      () =>
        new Response(JSON.stringify({ name: "Pinball Wizards" }), {
          status: 200,
        })
    );

    const fd = new FormData();
    fd.set("guildId", "123456789012345678");
    fd.set("newToken", VALID_TOKEN);
    const result = await validateServerId(fd);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.guildName).toBe("Pinball Wizards");
    }

    // Assert that fetch was called as expected
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(url).toBe("https://discord.com/api/v10/guilds/123456789012345678");
    expect(init?.method ?? "GET").toBe("GET");
    expect(init?.headers).toEqual({
      Authorization: `Bot ${VALID_TOKEN}`,
    });
  });

  it("returns invalid_input when serverId is non-numeric", async () => {
    const fd = new FormData();
    fd.set("guildId", "not-a-number");
    fd.set("newToken", VALID_TOKEN);
    const result = await validateServerId(fd);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("invalid_input");
    }
  });

  it("returns not_member when bot is not in the server (404)", async () => {
    mockFetch(() => new Response("{}", { status: 404 }));

    const fd = new FormData();
    fd.set("guildId", "123456789012345678");
    fd.set("newToken", VALID_TOKEN);
    const result = await validateServerId(fd);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("not_member");
    }
  });
});
