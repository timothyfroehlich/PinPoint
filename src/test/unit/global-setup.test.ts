import { beforeEach, describe, expect, it, vi } from "vitest";

const execSyncMock = vi.fn();

vi.mock("child_process", () => ({
  execSync: execSyncMock,
  default: { execSync: execSyncMock },
}));

// Mock postgres client for the pre-flight DB connectivity check
const endMock = vi.fn();
const sqlTagMock = Object.assign(
  vi.fn().mockResolvedValue([{ "?column?": 1 }]),
  {
    end: endMock,
  }
);
vi.mock("postgres", () => ({
  default: vi.fn(() => sqlTagMock),
}));

// Mock fetch for the Supabase health check
const fetchMock = vi.fn().mockResolvedValue({ ok: true });
vi.stubGlobal("fetch", fetchMock);

const loadSetup = async () => {
  const mod = await import("../../../e2e/global-setup");
  return mod.default;
};

const envBackup = { ...process.env };

describe("e2e/global-setup", () => {
  beforeEach(() => {
    vi.resetModules();
    execSyncMock.mockReset();
    fetchMock.mockReset().mockResolvedValue({ ok: true });
    sqlTagMock.mockReset().mockResolvedValue([{ "?column?": 1 }]);
    endMock.mockReset();
    process.env = {
      ...envBackup,
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
      POSTGRES_URL: "postgresql://postgres:postgres@localhost:54322/postgres",
    };
  });

  it("runs pre-flight checks, migrates, then fast-resets", async () => {
    execSyncMock.mockReturnValue(undefined);
    const setup = await loadSetup();

    await setup();

    // Pre-flight: Supabase health check
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:54321/auth/v1/health",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );

    // Pre-flight: Postgres connectivity
    expect(sqlTagMock).toHaveBeenCalled();
    expect(endMock).toHaveBeenCalled();

    // Migration then fast-reset
    expect(execSyncMock).toHaveBeenCalledTimes(2);
    expect(execSyncMock).toHaveBeenNthCalledWith(1, "pnpm run db:migrate", {
      stdio: "inherit",
      env: process.env,
    });
    expect(execSyncMock).toHaveBeenNthCalledWith(2, "pnpm run db:fast-reset", {
      stdio: "inherit",
      env: process.env,
    });
  });

  it("falls back to full reset when fast reset fails", async () => {
    // migrate succeeds, fast-reset fails, then fallback commands succeed
    execSyncMock
      .mockReturnValueOnce(undefined) // db:migrate
      .mockImplementationOnce(() => {
        throw new Error("fast reset failed"); // db:fast-reset
      })
      .mockReturnValue(undefined); // all fallback commands

    const setup = await loadSetup();

    await setup();

    expect(execSyncMock).toHaveBeenCalledWith("supabase db reset --yes", {
      stdio: "inherit",
      env: process.env,
    });
    expect(execSyncMock).toHaveBeenCalledWith("pnpm run db:_seed", {
      stdio: "inherit",
      env: process.env,
    });
    expect(execSyncMock).toHaveBeenCalledWith("pnpm run db:_seed-users", {
      stdio: "inherit",
      env: process.env,
    });
  });

  it("skips everything when SKIP_SUPABASE_RESET is set", async () => {
    process.env.SKIP_SUPABASE_RESET = "true";
    const setup = await loadSetup();

    await setup();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(execSyncMock).not.toHaveBeenCalled();
  });

  it("throws clear error when Supabase is not reachable", async () => {
    fetchMock.mockRejectedValue(new Error("fetch failed"));
    const setup = await loadSetup();

    await expect(setup()).rejects.toThrow("Supabase is not reachable");
  });

  it("throws clear error when Postgres is not reachable", async () => {
    sqlTagMock.mockRejectedValue(new Error("connection refused"));
    const setup = await loadSetup();

    await expect(setup()).rejects.toThrow("Cannot connect to Postgres");
  });

  it("throws clear error when POSTGRES_URL is not set", async () => {
    delete process.env.POSTGRES_URL;
    delete process.env.POSTGRES_URL_NON_POOLING;
    const setup = await loadSetup();

    await expect(setup()).rejects.toThrow("POSTGRES_URL is not set");
  });
});
