import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { SortOrderSchema } from "./SortOrderSchema";

export const MachineMinOrderByAggregateInputSchema: z.ZodType<Prisma.MachineMinOrderByAggregateInput> =
  z
    .object({
      id: z.lazy(() => SortOrderSchema).optional(),
      name: z.lazy(() => SortOrderSchema).optional(),
      organizationId: z.lazy(() => SortOrderSchema).optional(),
      locationId: z.lazy(() => SortOrderSchema).optional(),
      modelId: z.lazy(() => SortOrderSchema).optional(),
      ownerId: z.lazy(() => SortOrderSchema).optional(),
      ownerNotificationsEnabled: z.lazy(() => SortOrderSchema).optional(),
      notifyOnNewIssues: z.lazy(() => SortOrderSchema).optional(),
      notifyOnStatusChanges: z.lazy(() => SortOrderSchema).optional(),
      notifyOnComments: z.lazy(() => SortOrderSchema).optional(),
      qrCodeId: z.lazy(() => SortOrderSchema).optional(),
      qrCodeUrl: z.lazy(() => SortOrderSchema).optional(),
      qrCodeGeneratedAt: z.lazy(() => SortOrderSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.MachineMinOrderByAggregateInput>;

export default MachineMinOrderByAggregateInputSchema;
