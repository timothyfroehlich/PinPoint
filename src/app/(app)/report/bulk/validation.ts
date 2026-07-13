import { bulkRowSchema, type BulkRowInput } from "./schemas";

export type ParsedBulkRow =
  | { success: true; data: BulkRowInput }
  | { success: false; error: string };

/**
 * Validate one bulk row. Pure so it can be unit-tested and reused by the
 * server action without Server-Action plumbing.
 */
export function parseBulkRow(raw: unknown): ParsedBulkRow {
  const result = bulkRowSchema.safeParse(raw);
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
