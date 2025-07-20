import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { OrganizationCreateNestedOneWithoutPinballMapConfigInputSchema } from "./OrganizationCreateNestedOneWithoutPinballMapConfigInputSchema";

export const PinballMapConfigCreateInputSchema: z.ZodType<Prisma.PinballMapConfigCreateInput> =
  z
    .object({
      id: z.string().cuid().optional(),
      apiEnabled: z.boolean().optional(),
      apiKey: z.string().optional().nullable(),
      autoSyncEnabled: z.boolean().optional(),
      syncIntervalHours: z.number().int().optional(),
      lastGlobalSync: z.coerce.date().optional().nullable(),
      createMissingModels: z.boolean().optional(),
      updateExistingData: z.boolean().optional(),
      organization: z.lazy(
        () => OrganizationCreateNestedOneWithoutPinballMapConfigInputSchema,
      ),
    })
    .strict() as z.ZodType<Prisma.PinballMapConfigCreateInput>;

export default PinballMapConfigCreateInputSchema;
