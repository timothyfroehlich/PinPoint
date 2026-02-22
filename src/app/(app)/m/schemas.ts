/**
 * Machine Validation Schemas
 *
 * Zod schemas for machine CRUD operations.
 * Separated from Server Actions file per Next.js requirement.
 */

import { z } from "zod";
import { VALID_MACHINE_PRESENCE_STATUSES } from "~/lib/machines/presence";
import { opdbIdSchema } from "~/lib/opdb/types";

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
  opdbId: opdbIdSchema.optional(),
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
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Machine name must be less than 100 characters"),
  ownerId: z.string().uuid().optional(),
  presenceStatus: z.enum(VALID_MACHINE_PRESENCE_STATUSES).optional(),
  opdbId: opdbIdSchema.optional(),
});

export type UpdateMachineInput = z.infer<typeof updateMachineSchema>;
