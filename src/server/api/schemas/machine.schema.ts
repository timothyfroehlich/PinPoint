import { z } from "zod";
import { idSchema, machineIdSchema } from "~/lib/validation/schemas";

/**
 * Machine Creation Schema
 * Schema for creating new machines with required model and location
 */
export const machineCreateSchema = z.object({
  name: z.string().optional(),
  modelId: idSchema,
  locationId: idSchema,
});

/**
 * Machine Update Schema
 * Schema for updating existing machines
 */
export const machineUpdateSchema = z.object({
  id: machineIdSchema,
  name: z.string().optional(),
  modelId: idSchema.optional(),
  locationId: idSchema.optional(),
});

/**
 * Machine Owner Assignment Schema
 * For assigning or removing machine owners
 */
export const machineOwnerAssignmentSchema = z.object({
  machineId: machineIdSchema,
  ownerId: idSchema.optional(), // undefined/null removes owner
});

/**
 * Machine ID Validation Schema
 * For operations requiring just a machine ID
 */
export const machineIdParamSchema = z.object({
  id: machineIdSchema,
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
  id: machineIdSchema,
  name: z.string(),
  modelId: idSchema.optional(),
  locationId: idSchema.optional(),
  organizationId: idSchema,
  ownerId: idSchema.nullable().optional(),
  qrCodeId: idSchema.optional(),
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
      id: idSchema,
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
      id: idSchema,
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
      id: idSchema,
      name: z.string(),
      email: z.string(),
      profilePicture: z.string().nullable(),
    })
    .nullable()
    .optional(),
});

export const machineForIssuesSchema = z.object({
  id: idSchema,
  name: z.string(),
  model: z.object({
    id: idSchema,
    name: z.string(),
    manufacturer: z.string(),
    year: z.number().nullable(),
  }),
  location: z.object({
    id: idSchema,
    name: z.string(),
    address: z.string().nullable(),
  }),
});
