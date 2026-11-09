import { z } from "zod";

/**
 * The Surface a machine export comes from (machine-views §3.15). The server
 * resolves the scope's machines itself, with the same access checks the tab
 * uses — the client names the Surface, never its machine list.
 */
export const machineExportScopeSchema = z.discriminatedUnion("kind", [
  /** The Machines page: every machine. */
  z.object({ kind: z.literal("all") }),
  /** A standard Collection, by the handle in its URL: its id or view token. */
  z.object({ kind: z.literal("collection"), handle: z.string().min(1) }),
  /** A Tag, by its type and slug as they appear in its URL. */
  z.object({
    kind: z.literal("tag"),
    type: z.string().min(1),
    slug: z.string().min(1),
  }),
]);
export type MachineExportScope = z.infer<typeof machineExportScopeSchema>;

/**
 * Schema for the machine CSV export action input. The client sends the list's
 * URL query; the server parses and validates it exactly as the list does.
 */
export const exportMachinesSchema = z.object({
  /** The Machine View URL query (machine-views §7). */
  query: z.string().max(4000).optional(),
  /** The Surface the export comes from. */
  scope: machineExportScopeSchema,
});
