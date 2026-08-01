import { publicIssueSchema, type PublicIssueInput } from "./schemas";

export interface ParsedPublicIssue {
  success: true;
  data: PublicIssueInput;
}

export interface ParsedPublicIssueFailure {
  success: false;
  error: string;
}

export type ParsedPublicIssueResult =
  ParsedPublicIssue | ParsedPublicIssueFailure;

const toOptionalString = (
  value: FormDataEntryValue | null
): string | undefined => (typeof value === "string" ? value : undefined);

/**
 * Converts a FormData entry to a boolean, defaulting to `true` when the
 * field is absent (`null`).
 *
 * This function is designed for use with a companion hidden `<input>` that
 * always submits an explicit "true" or "false" string value, ensuring the
 * field is never absent in practice. The `null -> true` default acts as a
 * safe fallback so the opt-in behavior (e.g. "watch this issue") remains
 * enabled even if the hidden input is accidentally omitted.
 *
 * @see unified-report-form.tsx — hidden input pattern for the watchIssue field
 */
const toBooleanFromForm = (value: FormDataEntryValue | null): boolean => {
  if (value === null) return true;
  if (typeof value !== "string") return false;
  const normalized = value.toLowerCase();
  return normalized === "true" || normalized === "on" || normalized === "1";
};

/**
 * Extracts and validates public issue form data.
 *
 * Keeps validation in a pure helper so it can be unit-tested without
 * Server Action plumbing.
 */
export function parsePublicIssueForm(
  formData: FormData
): ParsedPublicIssueResult {
  const rawData = {
    machineId: toOptionalString(formData.get("machineId")),
    title: toOptionalString(formData.get("title")),
    description: toOptionalString(formData.get("description")),
    severity: toOptionalString(formData.get("severity")),
    firstName: toOptionalString(formData.get("firstName")),
    lastName: toOptionalString(formData.get("lastName")),
    email: toOptionalString(formData.get("email")),
    priority: toOptionalString(formData.get("priority")),
    frequency: toOptionalString(formData.get("frequency")),
    status: toOptionalString(formData.get("status")),
    assignedTo: toOptionalString(formData.get("assignedTo")),
    watchIssue: toBooleanFromForm(formData.get("watchIssue")),
    idempotencyKey: toOptionalString(formData.get("idempotencyKey")),
  };

  const validation = publicIssueSchema.safeParse(rawData);

  if (!validation.success) {
    // Surface the schema's own message verbatim — each one stands alone
    // ("Please select a machine"), so prefixing the raw field path
    // ("machineId: …") only leaks an internal name at the user. Mirrors
    // quick/validation.ts. (PP-idrb spec §7.)
    const message =
      validation.error.issues[0]?.message ?? "Invalid input: unable to parse";
    return { success: false, error: message };
  }

  return { success: true, data: validation.data };
}
