/**
 * Unit test: the shared cron route shell (PP-az4d.3, CORE-ARCH-015)
 *
 * Five cron routes used to catch their job's failure, `log.error` it and return
 * a 5xx, so a broken refresh never reached Sentry (Sentry auto-captures only
 * uncaught exceptions; PP-a5y). `runCron` is the one place that catch lives now.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { reportError } from "~/lib/observability/report-error";

import { CRON_FAILURE_STATUS, runCron } from "./run-cron";

vi.mock("~/lib/observability/report-error", () => ({ reportError: vi.fn() }));
vi.mock("~/lib/logger", () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const SECRET = "test-cron-secret";

function cronRequest(token: string = SECRET): Request {
  return new Request("http://localhost/api/cron/example", {
    headers: { authorization: `Bearer ${token}` },
  });
}

describe("runCron", () => {
  beforeEach(() => {
    vi.mocked(reportError).mockReset();
    vi.stubEnv("CRON_SECRET", SECRET);
  });

  it("reports a throwing job to reportError and answers with the shared failure status", async () => {
    const failure = new Error("upstream exploded");

    const response = await runCron(cronRequest(), "example.job", () =>
      Promise.reject(failure)
    );

    expect(reportError).toHaveBeenCalledTimes(1);
    expect(reportError).toHaveBeenCalledWith(failure, {
      action: "example.job",
    });
    expect(response.status).toBe(CRON_FAILURE_STATUS);
    expect(await response.json()).toEqual({
      error: "Cron job failed",
      action: "example.job",
    });
  });

  it("returns the job's body as JSON and reports nothing on success", async () => {
    const response = await runCron(cronRequest(), "example.job", () =>
      Promise.resolve({ ok: true, count: 3 })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, count: 3 });
    expect(reportError).not.toHaveBeenCalled();
  });

  it("rejects a wrong bearer before the job runs", async () => {
    const job = vi.fn(() => Promise.resolve({ ok: true }));

    const response = await runCron(cronRequest("nope"), "example.job", job);

    expect(response.status).toBe(401);
    expect(job).not.toHaveBeenCalled();
    expect(reportError).not.toHaveBeenCalled();
  });
});
