import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { PinballMapConfigIncludeSchema } from '../inputTypeSchemas/PinballMapConfigIncludeSchema'
import { PinballMapConfigWhereUniqueInputSchema } from '../inputTypeSchemas/PinballMapConfigWhereUniqueInputSchema'
import { OrganizationArgsSchema } from "../outputTypeSchemas/OrganizationArgsSchema"
// Select schema needs to be in file to prevent circular imports
//------------------------------------------------------

export const PinballMapConfigSelectSchema: z.ZodType<Prisma.PinballMapConfigSelect> = z.object({
  id: z.boolean().optional(),
  organizationId: z.boolean().optional(),
  apiEnabled: z.boolean().optional(),
  apiKey: z.boolean().optional(),
  autoSyncEnabled: z.boolean().optional(),
  syncIntervalHours: z.boolean().optional(),
  lastGlobalSync: z.boolean().optional(),
  createMissingModels: z.boolean().optional(),
  updateExistingData: z.boolean().optional(),
  organization: z.union([z.boolean(),z.lazy(() => OrganizationArgsSchema)]).optional(),
}).strict()

export const PinballMapConfigFindUniqueArgsSchema: z.ZodType<Prisma.PinballMapConfigFindUniqueArgs> = z.object({
  select: PinballMapConfigSelectSchema.optional(),
  include: z.lazy(() => PinballMapConfigIncludeSchema).optional(),
  where: PinballMapConfigWhereUniqueInputSchema,
}).strict() ;

export default PinballMapConfigFindUniqueArgsSchema;
