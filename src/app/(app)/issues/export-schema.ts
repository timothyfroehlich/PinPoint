import { z } from "zod";

/**
 * The Surface an export comes from (issues-list §5.4). The server resolves
 * the scope's machines itself, with the same access checks the tab uses —
 * the client names the Surface, never its machine list.
 */
export const exportScopeSchema = z.discriminatedUnion("kind", [
  /** A standard Collection, by the handle in its URL: its id or view token. */
  z.object({ kind: z.literal("collection"), handle: z.string().min(1) }),
  /** A Tag, by its type and slug as they appear in its URL. */
  z.object({
    kind: z.literal("tag"),
    type: z.string().min(1),
    slug: z.string().min(1),
  }),
]);
export type IssueExportScope = z.infer<typeof exportScopeSchema>;

/**
 * Schema for CSV export action input.
 *
 * The client sends the list's URL query; the server parses and validates it
 * exactly as the list does. machineInitials is passed separately for
 * machine-page exports.
 */
export const exportIssuesSchema = z.object({
  /** The Issue View URL query (issues-list §7). Omitted for machine exports. */
  query: z.string().max(4000).optional(),

  /**
   * Machine initials for machine-page export (overrides any machine filter).
   *
   * Stored initials are uppercase, and the machine filter matches them
   * case-sensitively, so lowercase input is normalized up here. Without it a
   * lowercase caller (e.g. "afm") matched nothing and the export came back
   * empty instead of returning the machine's issues (PP-mf4e).
   *
   * `reassignIssueMachineSchema.newMachineInitials` in ./schemas.ts validates
   * and uppercases initials the same way; kept separate per CORE-ARCH-010
   * until a third use justifies a shared helper.
   */
  machineInitials: z
    .string()
    .regex(/^[A-Za-z0-9]{2,6}$/, "Invalid machine initials")
    .transform((s) => s.toUpperCase())
    .optional(),

  /** The Collection or Tag Issues tab the export comes from. */
  scope: exportScopeSchema.optional(),
});
