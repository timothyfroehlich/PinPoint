/**
 * Machine Validation Schemas
 *
 * Zod schemas for machine CRUD operations.
 * Separated from Server Actions file per Next.js requirement.
 */

import { z } from "zod";

/**
 * Create Machine Schema
 *
 * Validates machine creation input.
 * - Name: Required, minimum 1 character (CORE-SEC-002)
 */
export const createMachineSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Machine name is required")
    .max(100, "Machine name must be less than 100 characters"),
});

export type CreateMachineInput = z.infer<typeof createMachineSchema>;

/**
 * Update Machine Schema
 *
 * Validates machine update input.
 * - ID: Required, UUID format
 * - Name: Required, minimum 1 character (CORE-SEC-002)
 */
export const updateMachineSchema = z.object({
  id: z.string().uuid("Invalid machine ID"),
  name: z
    .string()
    .trim()
    .min(1, "Machine name is required")
    .max(100, "Machine name must be less than 100 characters"),
});

export type UpdateMachineInput = z.infer<typeof updateMachineSchema>;
