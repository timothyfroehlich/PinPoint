// @vitest-environment node
import type { Breadcrumb, ErrorEvent, Log, Metric } from "@sentry/nextjs";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SENTRY_DATA_COLLECTION,
  SENTRY_PRIVACY_OPTIONS,
  sentryBeforeBreadcrumb,
  sentryBeforeSend,
  sentryBeforeSendLog,
  sentryBeforeSendMetric,
  sentryBeforeSendSpan,
  sentryBeforeSendTransaction,
} from "~/lib/observability/sentry-policy";

type SentrySpan = Parameters<typeof sentryBeforeSendSpan>[0];
type SentryTransaction = Parameters<typeof sentryBeforeSendTransaction>[0];

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("strict Sentry collection", () => {
  it("opts out of every automatic data category while preserving seven context lines", () => {
    expect(SENTRY_DATA_COLLECTION).toEqual({
      userInfo: false,
      cookies: false,
      httpHeaders: { request: false, response: false },
      httpBodies: [],
      urlQueryParams: false,
      graphQL: { document: false, variables: false },
      genAI: { inputs: false, outputs: false },
      databaseQueryData: false,
      stackFrameVariables: false,
      frameContextLines: 7,
    });
  });

  it("owns all six outbound sanitization hooks", () => {
    expect(SENTRY_PRIVACY_OPTIONS).toEqual({
      dataCollection: SENTRY_DATA_COLLECTION,
      beforeSend: sentryBeforeSend,
      beforeBreadcrumb: sentryBeforeBreadcrumb,
      beforeSendSpan: sentryBeforeSendSpan,
      beforeSendTransaction: sentryBeforeSendTransaction,
      beforeSendLog: sentryBeforeSendLog,
      beforeSendMetric: sentryBeforeSendMetric,
    });
  });
});

describe("sentryBeforeSend", () => {
  it("masks raw and encoded emails throughout error/message event data", () => {
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
      request: {
        url: "https://pinpoint.example/signup?email=victim%40example.com#form",
      },
      contexts: {
        mail: {
          response: `rejected ${recipient}`,
          retryValue: "victim%40example.com",
        },
      },
      extra: {
        rejected: [recipient, "victim%40example.com"],
      },
      user: { email: recipient },
      tags: { transport: "resend" },
    };

    const result = sentryBeforeSend(event);

    expect(result).not.toBeNull();
    expect(result?.message).toBe("Resend rejected vic***");
    expect(result?.exception?.values?.[0]?.value).toBe(
      "550 5.1.1 <vic***> recipient unknown"
    );
    expect(result?.request?.url).toBe("https://pinpoint.example/signup");
    expect(result?.contexts?.mail).toEqual({
      response: "rejected vic***",
      retryValue: "vic***",
    });
    expect(result?.extra?.rejected).toEqual(["vic***", "vic***"]);
    expect(result?.user?.email).toBe("vic***");
    expect(result?.tags).toEqual({ transport: "resend" });
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

  it("drops payloads whose nested data exceeds the sanitization boundary", () => {
    let nested: Record<string, unknown> = {
      recipient: "victim@example.com",
    };
    for (let depth = 0; depth < 65; depth += 1) nested = { nested };
    const event: ErrorEvent = { type: undefined, extra: { nested } };

    expect(sentryBeforeSend(event)).toBeNull();
  });

  it("drops payloads whose sensitive fields cannot be rewritten", () => {
    const event: ErrorEvent = {
      type: undefined,
      extra: Object.freeze({ recipient: "victim@example.com" }),
    };

    expect(sentryBeforeSend(event)).toBeNull();
  });

  it("masks email-bearing keys and drops collisions", () => {
    const safeEvent: ErrorEvent = {
      type: undefined,
      extra: { "victim@example.com": "recipient" },
    };
    const collidingEvent: ErrorEvent = {
      type: undefined,
      extra: {
        "victim@example.com": "recipient",
        "vic***": "existing",
      },
    };

    expect(sentryBeforeSend(safeEvent)?.extra).toEqual({
      "vic***": "recipient",
    });
    expect(sentryBeforeSend(collidingEvent)).toBeNull();
  });

  it("drops payloads when an email-bearing key cannot be deleted", () => {
    const extra: Record<string, unknown> = {};
    Object.defineProperty(extra, "victim@example.com", {
      configurable: false,
      enumerable: true,
      value: "recipient",
    });
    const event: ErrorEvent = { type: undefined, extra };

    expect(sentryBeforeSend(event)).toBeNull();
  });
});

describe("sentryBeforeSendTransaction", () => {
  it("sanitizes transaction request URLs and nested event data", () => {
    const transaction: SentryTransaction = {
      type: "transaction",
      transaction: "signup victim@example.com",
      request: {
        url: "https://pinpoint.example/signup?email=victim%40example.com#form",
      },
      contexts: { mail: { recipient: "victim%40example.com" } },
    };

    expect(sentryBeforeSendTransaction(transaction)).toEqual({
      type: "transaction",
      transaction: "signup vic***",
      request: { url: "https://pinpoint.example/signup" },
      contexts: { mail: { recipient: "vic***" } },
    });
  });
});

describe("sentryBeforeBreadcrumb", () => {
  it("sanitizes breadcrumb messages, nested data, and captured URLs", () => {
    const breadcrumb: Breadcrumb = {
      message: "Invite for victim@example.com",
      data: {
        url: "/signup?email=victim%40example.com#form",
        recipient: "victim%40example.com",
      },
    };

    expect(sentryBeforeBreadcrumb(breadcrumb)).toEqual({
      message: "Invite for vic***",
      data: { url: "/signup", recipient: "vic***" },
    });
  });
});

describe("sentryBeforeSendSpan", () => {
  it("sanitizes span descriptions, attributes, and captured URLs", () => {
    const span: SentrySpan = {
      data: {
        recipient: "victim@example.com",
        "http.url":
          "https://pinpoint.example/signup?email=victim%40example.com#form",
      },
      description: "invite victim%40example.com",
      span_id: "1234567890abcdef",
      start_timestamp: 1,
      trace_id: "1234567890abcdef1234567890abcdef",
    };

    expect(sentryBeforeSendSpan(span)).toMatchObject({
      data: {
        recipient: "vic***",
        "http.url": "https://pinpoint.example/signup",
      },
      description: "invite vic***",
    });
  });

  it("returns a minimal safe span with original trace correlation when a sensitive field is unwritable", () => {
    const span: SentrySpan = {
      data: Object.freeze({ recipient: "victim@example.com" }),
      description: "invite victim@example.com",
      span_id: "1234567890abcdef",
      start_timestamp: 1,
      trace_id: "1234567890abcdef1234567890abcdef",
    };

    expect(sentryBeforeSendSpan(span)).toEqual({
      data: {},
      span_id: "1234567890abcdef",
      start_timestamp: 1,
      trace_id: "1234567890abcdef1234567890abcdef",
    });
  });
});

describe("sentryBeforeSendLog", () => {
  it("sanitizes log messages and nested attributes", () => {
    const log: Log = {
      level: "error",
      message: "Invite victim@example.com failed",
      attributes: {
        recipient: "victim%40example.com",
        request: { url: "/signup?email=victim%40example.com#form" },
      },
    };

    expect(sentryBeforeSendLog(log)).toEqual({
      level: "error",
      message: "Invite vic*** failed",
      attributes: {
        recipient: "vic***",
        request: { url: "/signup" },
      },
    });
  });
});

describe("sentryBeforeSendMetric", () => {
  it("sanitizes metric names and nested attributes", () => {
    const metric: Metric = {
      name: "invite.victim@example.com",
      type: "counter",
      value: 1,
      attributes: {
        recipient: "victim%40example.com",
        requestUrl:
          "https://pinpoint.example/signup?email=victim%40example.com#form",
      },
    };

    expect(sentryBeforeSendMetric(metric)).toEqual({
      name: "inv***",
      type: "counter",
      value: 1,
      attributes: {
        recipient: "vic***",
        requestUrl: "https://pinpoint.example/signup",
      },
    });
  });
});
