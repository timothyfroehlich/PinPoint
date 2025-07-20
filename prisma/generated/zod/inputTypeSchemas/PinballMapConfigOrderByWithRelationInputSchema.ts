import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { SortOrderSchema } from "./SortOrderSchema";
import { SortOrderInputSchema } from "./SortOrderInputSchema";
import { OrganizationOrderByWithRelationInputSchema } from "./OrganizationOrderByWithRelationInputSchema";

export const PinballMapConfigOrderByWithRelationInputSchema: z.ZodType<Prisma.PinballMapConfigOrderByWithRelationInput> =
  z
    .object({
      id: z.lazy(() => SortOrderSchema).optional(),
      organizationId: z.lazy(() => SortOrderSchema).optional(),
      apiEnabled: z.lazy(() => SortOrderSchema).optional(),
      apiKey: z
        .union([
          z.lazy(() => SortOrderSchema),
          z.lazy(() => SortOrderInputSchema),
        ])
        .optional(),
      autoSyncEnabled: z.lazy(() => SortOrderSchema).optional(),
      syncIntervalHours: z.lazy(() => SortOrderSchema).optional(),
      lastGlobalSync: z
        .union([
          z.lazy(() => SortOrderSchema),
          z.lazy(() => SortOrderInputSchema),
        ])
        .optional(),
      createMissingModels: z.lazy(() => SortOrderSchema).optional(),
      updateExistingData: z.lazy(() => SortOrderSchema).optional(),
      organization: z
        .lazy(() => OrganizationOrderByWithRelationInputSchema)
        .optional(),
    })
    .strict() as z.ZodType<Prisma.PinballMapConfigOrderByWithRelationInput>;

export default PinballMapConfigOrderByWithRelationInputSchema;
