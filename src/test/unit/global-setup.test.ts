import { beforeEach, describe, expect, it, vi } from "vitest";

const execSyncMock = vi.fn();

vi.mock("child_process", () => ({
  execSync: execSyncMock,
  default: { execSync: execSyncMock },
}));

const loadSetup = async () => {
  const mod = await import("../../../e2e/global-setup");
  return mod.default;
};

const envBackup = { ...process.env };

describe("e2e/global-setup", () => {
  beforeEach(() => {
    vi.resetModules();
    execSyncMock.mockReset();
    process.env = { ...envBackup };
  });

  it("prefers fast reset path when it succeeds", async () => {
    execSyncMock.mockReturnValue(undefined);
    const setup = await loadSetup();

    await setup();

    expect(execSyncMock).toHaveBeenCalledTimes(1);
    expect(execSyncMock).toHaveBeenCalledWith("pnpm run db:fast-reset", {
      stdio: "inherit",
      env: process.env,
    });
  });

  it("falls back to full supabase reset when fast reset fails", async () => {
    execSyncMock.mockImplementationOnce(() => {
      throw new Error("fast reset failed");
    });
    execSyncMock.mockReturnValue(undefined);

    const setup = await loadSetup();

    await setup();

    expect(execSyncMock).toHaveBeenCalledWith("pnpm run db:fast-reset", {
      stdio: "inherit",
      env: process.env,
    });
    expect(execSyncMock).toHaveBeenCalledWith("supabase db reset --yes", {
      stdio: "inherit",
      env: process.env,
    });
    expect(execSyncMock).toHaveBeenCalledWith("pnpm run db:migrate", {
      stdio: "inherit",
      env: process.env,
    });
    expect(execSyncMock).toHaveBeenCalledWith(
      "pnpm run test:_generate-schema",
      {
        stdio: "inherit",
        env: process.env,
      }
    );
    expect(execSyncMock).toHaveBeenCalledWith("pnpm run db:_seed", {
      stdio: "inherit",
      env: process.env,
    });
    expect(execSyncMock).toHaveBeenCalledWith("pnpm run db:_seed-users", {
      stdio: "inherit",
      env: process.env,
    });
  });
});
