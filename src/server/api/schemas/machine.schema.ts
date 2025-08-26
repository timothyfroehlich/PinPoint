import { z } from "zod";

/**
 * Machine Creation Schema
 * Schema for creating new machines with required model and location
 */
export const machineCreateSchema = z.object({
  name: z.string().optional(),
  modelId: z.string().min(1, "Model ID is required"),
  locationId: z.string().min(1, "Location ID is required"),
});

/**
 * Machine Update Schema
 * Schema for updating existing machines
 */
export const machineUpdateSchema = z.object({
  id: z.string().min(1, "Machine ID is required"),
  name: z.string().optional(),
  modelId: z.string().optional(),
  locationId: z.string().optional(),
});

/**
 * Machine Owner Assignment Schema
 * For assigning or removing machine owners
 */
export const machineOwnerAssignmentSchema = z.object({
  machineId: z.string().min(1, "Machine ID is required"),
  ownerId: z.string().optional(), // undefined/null removes owner
});

/**
 * Machine ID Validation Schema
 * For operations requiring just a machine ID
 */
export const machineIdSchema = z.object({
  id: z.string().min(1, "Machine ID is required"),
});

/**
 * Machine Filter Schema
 * For filtering machines in list operations
 */
export const machineFilterSchema = z.object({
  locationId: z.string().optional(),
  modelId: z.string().optional(),
  ownerId: z.string().optional(),
  search: z.string().optional(),
  limit: z.number().min(1).max(1000).optional(),
  offset: z.number().min(0).optional(),
});

/**
 * Output validation schemas corresponding to machine response transformers
 */
export const machineResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  modelId: z.string().optional(),
  locationId: z.string().optional(),
  organizationId: z.string(),
  ownerId: z.string().nullable().optional(),
  qrCodeId: z.string().optional(),
  qrCodeUrl: z.string().optional(),
  qrCodeGeneratedAt: z.date().optional(),
  ownerNotificationsEnabled: z.boolean().optional(),
  notifyOnNewIssues: z.boolean().optional(),
  notifyOnStatusChanges: z.boolean().optional(),
  notifyOnComments: z.boolean().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  model: z
    .object({
      id: z.string(),
      name: z.string(),
      manufacturer: z.string(),
      year: z.number().nullable(),
      machineType: z.string(),
      ipdbUrl: z.string().nullable(),
      opdbId: z.string().nullable(),
    })
    .optional(),
  location: z
    .object({
      id: z.string(),
      name: z.string(),
      address: z.string().nullable(),
      city: z.string().nullable(),
      state: z.string().nullable(),
      zipCode: z.string().nullable(),
      country: z.string().nullable(),
    })
    .optional(),
  owner: z
    .object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
      profilePicture: z.string().nullable(),
    })
    .nullable()
    .optional(),
});

export const machineForIssuesSchema = z.object({
  id: z.string(),
  name: z.string(),
  model: z.object({
    id: z.string(),
    name: z.string(),
    manufacturer: z.string(),
    year: z.number().nullable(),
  }),
  location: z.object({
    id: z.string(),
    name: z.string(),
    address: z.string().nullable(),
  }),
});
