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
  | ParsedPublicIssue
  | ParsedPublicIssueFailure;

const toOptionalString = (
  value: FormDataEntryValue | null
): string | undefined => (typeof value === "string" ? value : undefined);

const toBooleanFromForm = (value: FormDataEntryValue | null): boolean => {
  if (value === null) return true;
  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    if (normalized === "true" || normalized === "on" || normalized === "1") {
      return true;
    }
    if (normalized === "false" || normalized === "off" || normalized === "0") {
      return false;
    }
  }
  if (typeof value === "boolean") {
    return value;
  }
  return false;
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
  };

  const validation = publicIssueSchema.safeParse(rawData);

  if (!validation.success) {
    const firstIssue = validation.error.issues[0];
    const field = firstIssue?.path.at(0);
    const message = firstIssue?.message ?? "Invalid input: unable to parse";
    const prefixedMessage = field ? `${String(field)}: ${message}` : message;
    return { success: false, error: prefixedMessage };
  }

  return { success: true, data: validation.data };
}
