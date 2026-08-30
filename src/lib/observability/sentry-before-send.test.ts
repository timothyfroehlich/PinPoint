// @vitest-environment node
import type { ErrorEvent } from "@sentry/nextjs";
import { afterEach, describe, expect, it, vi } from "vitest";

import { sentryBeforeSend } from "~/lib/observability/sentry-before-send";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("sentryBeforeSend", () => {
  it("masks email addresses in the event and exception messages", () => {
    const recipient = "victim@example.com";
    const event: ErrorEvent = {
      type: undefined,
      message: `Resend rejected ${recipient}`,
      exception: {
        values: [
          {
            type: "Error",
            value: `550 5.1.1 <${recipient}> recipient unknown`,
          },
        ],
      },
      tags: { transport: "resend" },
    };

    const result = sentryBeforeSend(event);

    expect(result).not.toBeNull();
    expect(result?.message).toBe("Resend rejected vic***");
    expect(result?.exception?.values?.[0]?.value).toBe(
      "550 5.1.1 <vic***> recipient unknown"
    );
    expect(result?.tags).toEqual({ transport: "resend" });
  });

  it("leaves diagnostics without an email unchanged", () => {
    const event: ErrorEvent = {
      type: undefined,
      message: "Connection refused",
      exception: {
        values: [{ type: "Error", value: "ECONNREFUSED" }],
      },
    };

    expect(sentryBeforeSend(event)).toEqual(event);
  });

  it("drops the known Supabase cold-start transient on previews", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    const event: ErrorEvent = {
      type: undefined,
      exception: {
        values: [{ type: "Error", value: "Tenant or user not found" }],
      },
    };

    expect(sentryBeforeSend(event)).toBeNull();
  });

  it("keeps the same Supabase error outside previews", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const event: ErrorEvent = {
      type: undefined,
      message: "Tenant or user not found",
    };

    expect(sentryBeforeSend(event)).toBe(event);
  });
});
