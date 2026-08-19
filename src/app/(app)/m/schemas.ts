/**
 * Machine Validation Schemas
 *
 * Zod schemas for machine CRUD operations.
 * Separated from Server Actions file per Next.js requirement.
 */

import { z } from "zod";
import { VALID_MACHINE_PRESENCE_STATUSES } from "~/lib/machines/presence";

/**
 * PinballMap linking fields shared by create + edit (bead B / PP-o355.2).
 * The picker submits `pinballmapMachineId`; the "not on PinballMap" choice
 * submits `pinballmapExcluded` (+ optional reason) and, since PP-3bbr, the
 * hand-entered `modelName` / `manufacturer` / `year` for a game the catalog
 * cannot cover.
 *
 * **For a LINKED machine model metadata is still not taken from the client** —
 * the server derives it from the catalog mirror. These three are read only on
 * the excluded branch of `resolvePbmLinkColumns*`, where there is no catalog row
 * to derive from and a person typing it is the only source there will be. A
 * request that sends them alongside a title has them dropped, and the DB CHECK
 * `machines_model_name_requires_excluded` is the backstop.
 *
 * **`pinballmapListed` is deliberately absent** and must not be added back
 * (PP-o355.29). It records that a listing exists on the public map, so only a
 * path that actually talked to PinballMap — or reconciled against a snapshot —
 * may set it. Accepting it here let a POST assert a public listing we never
 * made, with a null lmx and no API call (CORE-ARCH-012 honest failure), while
 * consuming the one-lister slot in `machines_pinballmap_listed_unique` so the
 * cabinet that genuinely holds the lmx could no longer be listed.
 */
const pinballmapLinkFields = {
  pinballmapMachineId: z.coerce.number().int().positive().optional(),
  pinballmapExcluded: z.boolean().optional(),
  pinballmapExcludedReason: z
    .string()
    .trim()
    .max(200, "Reason must be less than 200 characters")
    .optional(),
  modelName: z
    .string()
    .trim()
    // The catalog mirror's own `name` is unbounded `text`, so there is no
    // upstream width to match — 200 is a cap on free text arriving from a
    // request, sized well above any real game title.
    .max(200, "Model name must be less than 200 characters")
    .optional(),
  manufacturer: z
    .string()
    .trim()
    .max(100, "Manufacturer must be less than 100 characters")
    .optional(),
  // 1930 is a floor, not a guess: the first coin-operated pinball machines
  // (Ballyhoo, Baffle Ball) date to 1931, and APC's collection is meant to span
  // every era from the 1940s EMs on. The upper bound is next year rather than
  // this one — a game announced for the coming season is a real thing to own.
  year: z.coerce
    .number()
    .int()
    .min(1930, "Year must be 1930 or later")
    .max(new Date().getFullYear() + 1, "Year can't be that far in the future")
    .optional(),
};

/**
 * Create Machine Schema
 *
 * Validates machine creation input.
 * - Name: Required, minimum 1 character (CORE-SEC-002)
 * - Initials: Required, 2-6 alphanumeric chars, auto-uppercase (Machine Initials Plan)
 */
export const createMachineSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Machine name is required")
    .max(100, "Machine name must be less than 100 characters"),
  initials: z
    .string()
    .trim()
    .min(2, "Initials must be at least 2 characters")
    .max(6, "Initials must be at most 6 characters")
    .regex(/^[A-Z0-9]+$/i, "Only letters and numbers allowed")
    .transform((val) => val.toUpperCase()),
  ownerId: z.string().uuid().optional(),
  presenceStatus: z.enum(VALID_MACHINE_PRESENCE_STATUSES).optional(),
  forcePromoteUserId: z.string().uuid().optional(),
  ...pinballmapLinkFields,
});

export type CreateMachineInput = z.infer<typeof createMachineSchema>;

/**
 * Update Machine Schema
 *
 * Validates machine update input.
 * - ID: Required, UUID format
 * - Name: Required, minimum 1 character (CORE-SEC-002)
 * - Initials: Permanent, cannot be updated
 */
export const updateMachineSchema = z.object({
  id: z.string().uuid(),
  // Optional on update: `undefined` means "leave the name alone". Forms that
  // do not edit the name (ownership transfer) must omit it rather than
  // resubmit a page-load snapshot — doing so reverted a concurrent rename
  // (PP-o355.19 review). Absent is not the same as empty: a submitted name
  // still has to be 1-100 chars.
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Machine name must be less than 100 characters")
    .optional(),
  ownerId: z.string().uuid().optional(),
  presenceStatus: z.enum(VALID_MACHINE_PRESENCE_STATUSES).optional(),
  forcePromoteUserId: z.string().uuid().optional(),
  ...pinballmapLinkFields,
});

export type UpdateMachineInput = z.infer<typeof updateMachineSchema>;
