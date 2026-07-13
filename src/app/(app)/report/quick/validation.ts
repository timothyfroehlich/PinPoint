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
    const first = result.error.issues[0];
    const field = first?.path.at(0);
    const message = first?.message ?? "Invalid input";
    return {
      success: false,
      error: field ? `${String(field)}: ${message}` : message,
    };
  }
  return { success: true, data: result.data };
}
