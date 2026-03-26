/**
 * Pinball Map Validation Schemas
 *
 * Zod schemas for Pinball Map integration actions.
 */

import { z } from "zod";

export const searchPbmMachinesSchema = z.object({
  query: z.string().trim().min(2, "Search query must be at least 2 characters"),
});

export const linkPbmMachineSchema = z.object({
  machineId: z.string().uuid(),
  pbmMachineId: z.number().int().positive(),
  pbmMachineName: z.string().min(1),
});

export const unlinkPbmMachineSchema = z.object({
  machineId: z.string().uuid(),
});

export const addToPbmSchema = z.object({
  machineId: z.string().uuid(),
});

export const removeFromPbmSchema = z.object({
  machineId: z.string().uuid(),
});

export const updatePbmConfigSchema = z.object({
  locationId: z
    .number()
    .int()
    .positive("Location ID must be a positive number"),
  userEmail: z.string().email("Must be a valid email address"),
  userToken: z.string().min(1, "API token is required"),
});
