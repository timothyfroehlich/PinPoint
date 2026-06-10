import { describe, it, expect, beforeEach, vi } from "vitest";
import { AuthSessionMissingError } from "@supabase/supabase-js";

const captureExceptionMock = vi.fn();
const logErrorMock = vi.fn();

vi.mock("@sentry/nextjs", () => ({
  captureException: (...args: unknown[]) =>
    captureExceptionMock(...(args as Parameters<typeof captureExceptionMock>)),
}));

vi.mock("~/lib/logger", () => ({
  log: {
    error: (...args: unknown[]) =>
      logErrorMock(...(args as Parameters<typeof logErrorMock>)),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  reportAuthError,
  reportError,
  serverActionError,
} from "~/lib/observability/report-error";

beforeEach(() => {
  captureExceptionMock.mockReset();
  logErrorMock.mockReset();
});

describe("reportError", () => {
  it("forwards the error to Sentry with a pinpoint context", () => {
    const error = new Error("boom");
    reportError(error, { action: "createMachineAction", machineId: "abc" });

    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
    expect(captureExceptionMock).toHaveBeenCalledWith(error, {
      contexts: {
        pinpoint: { action: "createMachineAction", machineId: "abc" },
      },
    });
  });

  it("writes a structured log entry with the error under the err key", () => {
    const error = new Error("boom");
    reportError(error, { action: "doThing" });

    expect(logErrorMock).toHaveBeenCalledTimes(1);
    const [payload, msg] = logErrorMock.mock.calls[0] ?? [];
    expect(payload).toMatchObject({ err: error, action: "doThing" });
    expect(msg).toBe("doThing");
  });

  it("uses a default message when no action is provided", () => {
    reportError(new Error("nope"));
    const [, msg] = logErrorMock.mock.calls[0] ?? [];
    expect(msg).toBe("Caught error");
  });

  it("works with non-Error inputs (still captures)", () => {
    reportError("string error", { action: "weird" });
    expect(captureExceptionMock).toHaveBeenCalledWith("string error", {
      contexts: { pinpoint: { action: "weird" } },
    });
  });

  it("preserves a bestEffort flag in both pipelines", () => {
    const error = new Error("notification failed");
    reportError(error, { action: "notify", bestEffort: true });

    expect(captureExceptionMock).toHaveBeenCalledWith(error, {
      contexts: { pinpoint: { action: "notify", bestEffort: true } },
    });
    const [payload] = logErrorMock.mock.calls[0] ?? [];
    expect(payload).toMatchObject({ action: "notify", bestEffort: true });
  });
});

describe("reportAuthError", () => {
  it("does NOT report an AuthSessionMissingError (normal no-session response)", () => {
    const error = new AuthSessionMissingError();
    reportAuthError(error, { action: "my-page.auth.getUser" });

    expect(captureExceptionMock).not.toHaveBeenCalled();
    expect(logErrorMock).not.toHaveBeenCalled();
  });

  it("forwards a real auth error (non-AuthSessionMissingError) to Sentry and log", () => {
    const error = new Error("token validation failed");
    reportAuthError(error, {
      action: "my-page.auth.getUser",
      bestEffort: true,
    });

    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
    expect(captureExceptionMock).toHaveBeenCalledWith(error, {
      contexts: {
        pinpoint: { action: "my-page.auth.getUser", bestEffort: true },
      },
    });
    expect(logErrorMock).toHaveBeenCalledTimes(1);
  });

  it("works with no context argument", () => {
    const error = new Error("network error");
    reportAuthError(error);

    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
    expect(logErrorMock).toHaveBeenCalledTimes(1);
  });
});

describe("serverActionError", () => {
  it("returns a Result err with the supplied code and message", () => {
    const result = serverActionError(
      new Error("boom"),
      "SERVER",
      "Failed to create machine."
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("SERVER");
      expect(result.message).toBe("Failed to create machine.");
    }
  });

  it("captures the error to Sentry and the logger before returning", () => {
    const error = new Error("boom");
    serverActionError(error, "SERVER", "msg", { action: "create" });

    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
    expect(logErrorMock).toHaveBeenCalledTimes(1);
  });

  it("narrows the Result type to the supplied code literal", () => {
    const result = serverActionError(
      new Error("x"),
      "VALIDATION" as const,
      "bad input"
    );
    if (!result.ok) {
      // Type assertion: `code` should be the literal "VALIDATION" here.
      const code: "VALIDATION" = result.code;
      expect(code).toBe("VALIDATION");
    }
  });
});
