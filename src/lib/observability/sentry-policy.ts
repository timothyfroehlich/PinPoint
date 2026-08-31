import type * as Sentry from "@sentry/nextjs";
import type { Breadcrumb, ErrorEvent, Log, Metric } from "@sentry/nextjs";

import { maskEmailsInText } from "~/lib/logging/mask";

const SUPABASE_AUTH_COLD_START_MESSAGE = "Tenant or user not found";
const MAX_SANITIZE_DEPTH = 64;

type SentryInitOptions = Parameters<typeof Sentry.init>[0];
type SentrySpan = Parameters<
  NonNullable<SentryInitOptions["beforeSendSpan"]>
>[0];
type SentryTransaction = Parameters<
  NonNullable<SentryInitOptions["beforeSendTransaction"]>
>[0];

/** Strict, explicit collection contract shared by browser, server, and edge. */
export const SENTRY_DATA_COLLECTION = {
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
} satisfies NonNullable<SentryInitOptions["dataCollection"]>;

/**
 * Remove query and fragment data from a captured URL while preserving its
 * scheme, host, and path. URL-looking values are recognized even when nested
 * under a neutral array index; URL-named fields are handled defensively too.
 */
function stripCapturedUrlDetails(value: string, key: string): string {
  const normalizedKey = key.toLowerCase();
  const hasUrlKey =
    normalizedKey === "url" ||
    normalizedKey === "href" ||
    normalizedKey === "uri" ||
    normalizedKey.endsWith(".url") ||
    normalizedKey.endsWith("_url") ||
    normalizedKey.endsWith("-url") ||
    normalizedKey.endsWith("url");
  const looksLikeUrl =
    /^[a-z][a-z\d+.-]*:\/\//iu.test(value) || /^\/{1,2}[^/]/u.test(value);

  if (!hasUrlKey && !looksLikeUrl) return value;

  const queryIndex = value.indexOf("?");
  const fragmentIndex = value.indexOf("#");
  const cutAt =
    queryIndex === -1
      ? fragmentIndex
      : fragmentIndex === -1
        ? queryIndex
        : Math.min(queryIndex, fragmentIndex);

  return cutAt === -1 ? value : value.slice(0, cutAt);
}

function sanitizeSentryString(value: string, key: string): string {
  return stripCapturedUrlDetails(maskEmailsInText(value), key);
}

/**
 * Sanitize strings in an SDK-created structured payload without claiming that
 * an arbitrary transformed value preserves a generic caller type. The Sentry
 * hooks intentionally receive mutable payload objects. String leaves and
 * email-bearing keys are rewritten in place; channel adapters fail closed when
 * the payload cannot be inspected or changed safely.
 */
function sanitizeStructuredData(
  value: unknown,
  depth: number,
  seen: WeakSet<object>
): boolean {
  if (value === null || typeof value !== "object") return true;
  if (depth >= MAX_SANITIZE_DEPTH) return false;
  if (seen.has(value)) return true;
  seen.add(value);

  let keys: string[];
  try {
    keys = Object.keys(value);
  } catch {
    return false;
  }

  for (const key of keys) {
    let child: unknown;
    try {
      child = Reflect.get(value, key);
    } catch {
      return false;
    }

    if (typeof child === "string") {
      const sanitized = sanitizeSentryString(child, key);
      if (sanitized !== child) {
        try {
          if (!Reflect.set(value, key, sanitized)) return false;
          if (Reflect.get(value, key) !== sanitized) return false;
          child = sanitized;
        } catch {
          return false;
        }
      }
    } else if (!sanitizeStructuredData(child, depth + 1, seen)) {
      return false;
    }

    const sanitizedKey = maskEmailsInText(key);
    if (sanitizedKey === key) continue;

    try {
      if (Object.hasOwn(value, sanitizedKey)) return false;
      if (
        !Reflect.defineProperty(value, sanitizedKey, {
          configurable: true,
          enumerable: true,
          value: child,
          writable: true,
        })
      ) {
        return false;
      }
      if (!Reflect.deleteProperty(value, key)) return false;
    } catch {
      return false;
    }
  }

  return true;
}

function sanitizeChannelPayload(value: object): boolean {
  return sanitizeStructuredData(value, 0, new WeakSet());
}

/**
 * Error/message hook. Sentry v10 emits Feedback through its separate
 * `beforeSendFeedback` channel, so the deliberately entered contact email is
 * not rewritten here.
 */
export function sentryBeforeSend(event: ErrorEvent): ErrorEvent | null {
  if (process.env["VERCEL_ENV"] === "preview") {
    const inMessage =
      event.message?.includes(SUPABASE_AUTH_COLD_START_MESSAGE) ?? false;
    const inException =
      event.exception?.values?.some(
        (exception) =>
          exception.value?.includes(SUPABASE_AUTH_COLD_START_MESSAGE) ?? false
      ) ?? false;
    if (inMessage || inException) return null;
  }

  return sanitizeChannelPayload(event) ? event : null;
}

export function sentryBeforeBreadcrumb(
  breadcrumb: Breadcrumb
): Breadcrumb | null {
  return sanitizeChannelPayload(breadcrumb) ? breadcrumb : null;
}

export function sentryBeforeSendSpan(span: SentrySpan): SentrySpan {
  if (sanitizeChannelPayload(span)) return span;
  return {
    data: {},
    span_id: span.span_id,
    start_timestamp: span.start_timestamp,
    trace_id: span.trace_id,
  };
}

export function sentryBeforeSendTransaction(
  transaction: SentryTransaction
): SentryTransaction | null {
  return sanitizeChannelPayload(transaction) ? transaction : null;
}

export function sentryBeforeSendLog(log: Log): Log | null {
  return sanitizeChannelPayload(log) ? log : null;
}

export function sentryBeforeSendMetric(metric: Metric): Metric | null {
  return sanitizeChannelPayload(metric) ? metric : null;
}

type SentryPrivacyOptionKeys =
  | "dataCollection"
  | "beforeSend"
  | "beforeBreadcrumb"
  | "beforeSendSpan"
  | "beforeSendTransaction"
  | "beforeSendLog"
  | "beforeSendMetric";

/** PinPoint-owned privacy boundary shared verbatim by all Sentry runtimes. */
export const SENTRY_PRIVACY_OPTIONS = {
  dataCollection: SENTRY_DATA_COLLECTION,
  beforeSend: sentryBeforeSend,
  beforeBreadcrumb: sentryBeforeBreadcrumb,
  beforeSendSpan: sentryBeforeSendSpan,
  beforeSendTransaction: sentryBeforeSendTransaction,
  beforeSendLog: sentryBeforeSendLog,
  beforeSendMetric: sentryBeforeSendMetric,
} satisfies Pick<SentryInitOptions, SentryPrivacyOptionKeys>;
