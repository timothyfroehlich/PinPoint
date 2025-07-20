import type { Prisma } from "@prisma/client";

import { z } from "zod";

export const PinballMapConfigUncheckedCreateInputSchema: z.ZodType<Prisma.PinballMapConfigUncheckedCreateInput> =
  z
    .object({
      id: z.string().cuid().optional(),
      organizationId: z.string(),
      apiEnabled: z.boolean().optional(),
      apiKey: z.string().optional().nullable(),
      autoSyncEnabled: z.boolean().optional(),
      syncIntervalHours: z.number().int().optional(),
      lastGlobalSync: z.coerce.date().optional().nullable(),
      createMissingModels: z.boolean().optional(),
      updateExistingData: z.boolean().optional(),
    })
    .strict() as z.ZodType<Prisma.PinballMapConfigUncheckedCreateInput>;

export default PinballMapConfigUncheckedCreateInputSchema;
