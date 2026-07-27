import type { FullConfig } from "@playwright/test";
import { beforeEach, describe, expect, it, vi } from "vitest";

const execSyncMock = vi.fn();
// spawnSync is used by the Docker preflight check. Default to success.
const spawnSyncMock = vi.fn(
  (): { status: number | null; error: Error | null } => ({
    status: 0,
    error: null,
  })
);

// existsSync is used by the browser-binary preflight check. Default to true
// (binary present) so non-browser tests are unaffected.
const existsSyncMock = vi.fn(() => true);

vi.mock("child_process", () => ({
  execSync: execSyncMock,
  spawnSync: spawnSyncMock,
  default: { execSync: execSyncMock, spawnSync: spawnSyncMock },
}));

vi.mock("fs", () => ({
  existsSync: existsSyncMock,
  default: { existsSync: existsSyncMock },
}));

// The browser-binaries preflight only inspects projects in the config we
// pass in. An empty `projects` array therefore disables browser checks for
// these unit tests, keeping coverage focused on the DB orchestration flow.
const EMPTY_CONFIG = { projects: [] } as unknown as FullConfig;

// A minimal config with one chromium project, used to exercise the
// browser-binary preflight with a real (mocked) path check.
const CHROMIUM_CONFIG = {
  projects: [{ use: { browserName: "chromium" } }],
} as unknown as FullConfig;

// The render probe launches each needed+installed engine. Mock the engines so
// unit tests never spawn a real browser: `launch` is controlled per-test, and
// `executablePath` feeds the (mocked) existsSync binary check above.
const launchMock = vi.fn();
vi.mock("@playwright/test", () => {
  const engine = {
    launch: (): unknown => launchMock(),
    executablePath: (): string => "/fake/browser",
  };
  return { chromium: engine, firefox: engine, webkit: engine };
});

/** A browser whose page reports `width` for the probe's text measurement. */
const browserRendering = (width: number): unknown => ({
  newPage: () =>
    Promise.resolve({
      setContent: () => Promise.resolve(undefined),
      evaluate: () => Promise.resolve(width),
    }),
  close: () => Promise.resolve(undefined),
});

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
    spawnSyncMock.mockReset().mockReturnValue({ status: 0, error: null });
    existsSyncMock.mockReset().mockReturnValue(true);
    launchMock.mockReset().mockResolvedValue(browserRendering(42));
    fetchMock.mockReset().mockResolvedValue({ ok: true });
    sqlTagMock.mockReset().mockResolvedValue([{ "?column?": 1 }]);
    endMock.mockReset();
    process.env = {
      ...envBackup,
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
      POSTGRES_URL: "postgresql://postgres:postgres@localhost:54322/postgres",
      // Keep the Docker readiness retry loop fast and deterministic in tests:
      // a few attempts, no real sleep between them.
      E2E_DOCKER_READY_ATTEMPTS: "3",
      E2E_DOCKER_READY_DELAY_MS: "0",
    };
  });

  it("runs pre-flight checks, migrates, then fast-resets", async () => {
    execSyncMock.mockReturnValue(undefined);
    const setup = await loadSetup();

    await setup(EMPTY_CONFIG);

    // Pre-flight: Docker check via spawnSync
    expect(spawnSyncMock).toHaveBeenCalledWith(
      "docker",
      ["info"],
      expect.any(Object)
    );

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

    await setup(EMPTY_CONFIG);

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

    await setup(EMPTY_CONFIG);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(execSyncMock).not.toHaveBeenCalled();
  });

  it("throws clear error when Supabase is not reachable", async () => {
    fetchMock.mockRejectedValue(new Error("fetch failed"));
    const setup = await loadSetup();

    await expect(setup(EMPTY_CONFIG)).rejects.toThrow(
      "Supabase is not reachable"
    );
  });

  it("throws clear error when Postgres is not reachable", async () => {
    sqlTagMock.mockRejectedValue(new Error("connection refused"));
    const setup = await loadSetup();

    await expect(setup(EMPTY_CONFIG)).rejects.toThrow(
      "Cannot connect to Postgres"
    );
  });

  it("throws clear error when POSTGRES_URL is not set", async () => {
    delete process.env.POSTGRES_URL;
    delete process.env.POSTGRES_URL_NON_POOLING;
    const setup = await loadSetup();

    await expect(setup(EMPTY_CONFIG)).rejects.toThrow(
      "POSTGRES_URL is not set"
    );
  });

  it("throws daemon-down error after exhausting retries when Docker stays down", async () => {
    spawnSyncMock.mockReturnValue({ status: 1, error: null });
    const setup = await loadSetup();

    await expect(setup(EMPTY_CONFIG)).rejects.toThrow(
      "Docker daemon is not running"
    );
    // Retried up to the configured budget (E2E_DOCKER_READY_ATTEMPTS=3) before
    // giving up, rather than failing on the first transient miss.
    expect(spawnSyncMock).toHaveBeenCalledTimes(3);
  });

  it("recovers when Docker becomes ready within the retry budget", async () => {
    // Daemon not ready on the first two polls, then comes up — global-setup
    // should tolerate the transient startup delay and proceed (PP-149t).
    spawnSyncMock
      .mockReturnValueOnce({ status: 1, error: null })
      .mockReturnValueOnce({ status: 1, error: null })
      .mockReturnValue({ status: 0, error: null });
    execSyncMock.mockReturnValue(undefined);
    const setup = await loadSetup();

    await setup(EMPTY_CONFIG);

    expect(spawnSyncMock).toHaveBeenCalledTimes(3);
    // Proceeded past the Docker check to the Supabase health probe.
    expect(fetchMock).toHaveBeenCalled();
  });

  it("falls back to the default budget when retry env vars are invalid", async () => {
    // A typo'd attempts value must not skip the probe (NaN loop → 0 probes)
    // or, via an invalid delay, block forever — the budget stays bounded.
    process.env.E2E_DOCKER_READY_ATTEMPTS = "abc";
    process.env.E2E_DOCKER_READY_DELAY_MS = "0";
    spawnSyncMock.mockReturnValue({ status: 1, error: null });
    const setup = await loadSetup();

    await expect(setup(EMPTY_CONFIG)).rejects.toThrow(
      "Docker daemon is not running"
    );
    // Invalid attempts → falls back to the default of 15, still probing.
    expect(spawnSyncMock).toHaveBeenCalledTimes(15);
  });

  it("fails fast without retrying when Docker is not installed (ENOENT)", async () => {
    const enoent = Object.assign(new Error("spawn docker ENOENT"), {
      code: "ENOENT",
    });
    spawnSyncMock.mockReturnValue({ status: null, error: enoent });
    const setup = await loadSetup();

    await expect(setup(EMPTY_CONFIG)).rejects.toThrow(
      "Docker is not installed"
    );
    // ENOENT is fatal immediately — retrying won't install Docker.
    expect(spawnSyncMock).toHaveBeenCalledTimes(1);
  });

  it("throws install hint when a required browser binary is missing", async () => {
    // existsSync returns false → binary absent → should suggest install
    existsSyncMock.mockReturnValue(false);
    const setup = await loadSetup();

    await expect(setup(CHROMIUM_CONFIG)).rejects.toThrow(
      "pnpm exec playwright install"
    );
  });

  // Regression guard for PP-8b6j: a stale fontconfig cache left Chromium
  // launching fine but shaping zero glyphs, so it aborted the moment a spec
  // typed. Every symptom surfaced far downstream (auth-setup landing on
  // /login), so the probe has to name the real cause here.
  it("throws with the font remedy when an engine renders no glyphs", async () => {
    launchMock.mockResolvedValue(browserRendering(0));
    const setup = await loadSetup();

    await expect(setup(CHROMIUM_CONFIG)).rejects.toThrow(
      "rm -f ~/.cache/fontconfig/*.cache-*"
    );
  });

  it("names the missing system library when an engine can't launch", async () => {
    launchMock.mockRejectedValue(
      new Error(
        "browserType.launch: Target page, context or browser has been closed\n" +
          "MiniBrowser: error while loading shared libraries: libicudata.so.74: " +
          "cannot open shared object file: No such file or directory"
      )
    );
    const setup = await loadSetup();

    // The font remedy would be actively misleading here, so it must not appear.
    const message = String(
      await setup(CHROMIUM_CONFIG).catch((e: unknown) => e)
    );
    expect(message).toContain("libicudata.so.74");
    expect(message).not.toContain("fc-cache");
  });

  // A launch failure we can't classify must stay neutral rather than guess.
  // Naming fonts here would send the reader to wipe a cache that is fine while
  // the real cause — load, a sandbox denial — goes unread.
  it("does not blame fonts for an unrecognized launch failure", async () => {
    launchMock.mockRejectedValue(
      new Error("browserType.launch: Timeout 30000ms exceeded.")
    );
    const setup = await loadSetup();

    const message = String(
      await setup(CHROMIUM_CONFIG).catch((e: unknown) => e)
    );
    expect(message).toContain("Timeout 30000ms exceeded");
    expect(message).not.toContain("fc-cache");
    expect(message).not.toContain("font stack");
  });

  it("proceeds when the engine renders text", async () => {
    execSyncMock.mockReturnValue(undefined);
    const setup = await loadSetup();

    await expect(setup(CHROMIUM_CONFIG)).resolves.toBeUndefined();
    expect(launchMock).toHaveBeenCalledTimes(1);
  });

  it("does not launch a browser when the config declares no projects", async () => {
    execSyncMock.mockReturnValue(undefined);
    const setup = await loadSetup();

    await setup(EMPTY_CONFIG);

    expect(launchMock).not.toHaveBeenCalled();
  });

  it("does not probe an engine whose binary is absent", async () => {
    // Missing binaries are checkBrowserBinaries' story — probing them anyway
    // would report "no glyphs" for what is really an uninstalled browser.
    existsSyncMock.mockReturnValue(false);
    const setup = await loadSetup();

    await expect(setup(CHROMIUM_CONFIG)).rejects.toThrow(
      "Missing Playwright browser binaries"
    );
    expect(launchMock).not.toHaveBeenCalled();
  });

  it("checks Docker before Supabase health (ordering)", async () => {
    // Fail Docker so we never reach Supabase; if fetch were called first the
    // test order would be inverted.
    spawnSyncMock.mockReturnValue({ status: 1, error: null });
    const setup = await loadSetup();

    await expect(setup(EMPTY_CONFIG)).rejects.toThrow(
      "Docker daemon is not running"
    );
    // Supabase health check must NOT have been attempted
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
