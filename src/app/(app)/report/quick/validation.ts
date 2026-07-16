import { quickRowSchema, type QuickRowInput } from "./schemas";

export type ParsedQuickRow =
  { success: true; data: QuickRowInput } | { success: false; error: string };

/**
 * Validate one quick row. Pure so it can be unit-tested and reused by the
 * server action without Server-Action plumbing.
 */
export function parseQuickRow(raw: unknown): ParsedQuickRow {
  const result = quickRowSchema.safeParse(raw);
  if (!result.success) {
    // Surface the schema's own message verbatim — each one is written to stand
    // alone ("Please select a machine"), so prefixing the raw field path
    // ("machineId: …") only leaks an internal name at the user.
    const message = result.error.issues[0]?.message ?? "Invalid input";
    return { success: false, error: message };
  }
  return { success: true, data: result.data };
}
