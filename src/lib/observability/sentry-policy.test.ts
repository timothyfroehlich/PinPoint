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
        url: "https://pinpoint.example/signup?email=victim@example.com#form",
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

  it("masks recursively encoded emails and fails closed past the decode limit", () => {
    const nestedRedirect = encodeURIComponent(
      "/signup?email=victim%40example.com"
    );
    let overEncoded = "victim@example.com";
    for (let pass = 0; pass < 65; pass += 1) {
      overEncoded = encodeURIComponent(overEncoded);
    }
    const event: ErrorEvent = {
      type: undefined,
      message: `Invite redirect ${nestedRedirect}`,
      extra: { overEncoded },
    };

    const result = sentryBeforeSend(event);

    expect(result?.message).toBe("Invite redirect /signup?email=vic***");
    expect(result?.extra?.overEncoded).toBe("[redacted]");
  });

  it("preserves encoded non-email text and redacts undecodable email candidates", () => {
    const event: ErrorEvent = {
      type: undefined,
      extra: {
        malformedCandidate: "victim%40example.com%ZZ",
        nonEmailEncoding: "status%40",
      },
    };

    expect(sentryBeforeSend(event)?.extra).toEqual({
      malformedCandidate: "[redacted]",
      nonEmailEncoding: "status%40",
    });
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
        "http.query": "?token=secret",
        "http.fragment": "form",
        "url.query": "?token=secret",
        "url.fragment": "form",
        query_string: "token=secret",
      },
      description: "invite victim%40example.com",
      span_id: "1234567890abcdef",
      start_timestamp: 1,
      trace_id: "1234567890abcdef1234567890abcdef",
    };

    const result = sentryBeforeSendSpan(span);

    expect(result.data).toEqual({
      recipient: "vic***",
      "http.url": "https://pinpoint.example/signup",
    });
    expect(result.description).toBe("invite vic***");
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

  it("returns a contract-valid safe span when trace correlation cannot be read", () => {
    const span: SentrySpan = {
      data: { recipient: "victim@example.com" },
      span_id: "1234567890abcdef",
      start_timestamp: 1,
      trace_id: "1234567890abcdef1234567890abcdef",
    };
    Object.defineProperty(span, "span_id", {
      enumerable: true,
      get() {
        throw new Error("opaque span");
      },
    });

    expect(sentryBeforeSendSpan(span)).toEqual({
      data: {},
      span_id: "0000000000000001",
      start_timestamp: 0,
      trace_id: "00000000000000000000000000000001",
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

  it("drops logs whose attributes can serialize hidden email data", () => {
    class ContactAttribute {
      toJSON(): string {
        return "victim@example.com";
      }
    }

    const log: Log = {
      level: "error",
      message: "Invite failed",
      attributes: { contact: new ContactAttribute() },
    };

    expect(sentryBeforeSendLog(log)).toBeNull();
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

  it("drops metrics whose attributes can serialize hidden email data", () => {
    class ContactAttribute {
      toJSON(): string {
        return "victim@example.com";
      }
    }

    const metric: Metric = {
      name: "invite.failed",
      type: "counter",
      value: 1,
      attributes: { contact: new ContactAttribute() },
    };

    expect(sentryBeforeSendMetric(metric)).toBeNull();
  });
});
