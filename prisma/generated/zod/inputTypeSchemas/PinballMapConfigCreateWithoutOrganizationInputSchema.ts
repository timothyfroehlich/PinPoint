import type { Prisma } from '@prisma/client';

import { z } from 'zod';

export const PinballMapConfigCreateWithoutOrganizationInputSchema: z.ZodType<Prisma.PinballMapConfigCreateWithoutOrganizationInput> = z.object({
  id: z.string().cuid().optional(),
  apiEnabled: z.boolean().optional(),
  apiKey: z.string().optional().nullable(),
  autoSyncEnabled: z.boolean().optional(),
  syncIntervalHours: z.number().int().optional(),
  lastGlobalSync: z.coerce.date().optional().nullable(),
  createMissingModels: z.boolean().optional(),
  updateExistingData: z.boolean().optional()
}).strict();

export default PinballMapConfigCreateWithoutOrganizationInputSchema;
