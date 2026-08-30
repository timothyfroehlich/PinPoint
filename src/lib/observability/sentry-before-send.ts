import type { ErrorEvent } from "@sentry/nextjs";

import { maskEmailsInText } from "~/lib/logging/mask";

const SUPABASE_AUTH_COLD_START_MESSAGE = "Tenant or user not found";

/**
 * Apply PinPoint's server/edge Sentry event policy before an error leaves the
 * process: drop the known preview-only Supabase transient and mask email
 * addresses in every first-class Sentry error message field.
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

  if (event.message !== undefined) {
    event.message = maskEmailsInText(event.message);
  }
  for (const exception of event.exception?.values ?? []) {
    if (exception.value !== undefined) {
      exception.value = maskEmailsInText(exception.value);
    }
  }

  return event;
}
