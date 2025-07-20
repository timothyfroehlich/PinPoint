import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { OrganizationArgsSchema } from "../outputTypeSchemas/OrganizationArgsSchema"

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

export default PinballMapConfigSelectSchema;
