import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { SortOrderSchema } from "./SortOrderSchema";
import { SortOrderInputSchema } from "./SortOrderInputSchema";
import { MachineCountOrderByAggregateInputSchema } from "./MachineCountOrderByAggregateInputSchema";
import { MachineMaxOrderByAggregateInputSchema } from "./MachineMaxOrderByAggregateInputSchema";
import { MachineMinOrderByAggregateInputSchema } from "./MachineMinOrderByAggregateInputSchema";

export const MachineOrderByWithAggregationInputSchema: z.ZodType<Prisma.MachineOrderByWithAggregationInput> =
  z
    .object({
      id: z.lazy(() => SortOrderSchema).optional(),
      name: z.lazy(() => SortOrderSchema).optional(),
      organizationId: z.lazy(() => SortOrderSchema).optional(),
      locationId: z.lazy(() => SortOrderSchema).optional(),
      modelId: z.lazy(() => SortOrderSchema).optional(),
      ownerId: z
        .union([
          z.lazy(() => SortOrderSchema),
          z.lazy(() => SortOrderInputSchema),
        ])
        .optional(),
      ownerNotificationsEnabled: z.lazy(() => SortOrderSchema).optional(),
      notifyOnNewIssues: z.lazy(() => SortOrderSchema).optional(),
      notifyOnStatusChanges: z.lazy(() => SortOrderSchema).optional(),
      notifyOnComments: z.lazy(() => SortOrderSchema).optional(),
      qrCodeId: z.lazy(() => SortOrderSchema).optional(),
      qrCodeUrl: z
        .union([
          z.lazy(() => SortOrderSchema),
          z.lazy(() => SortOrderInputSchema),
        ])
        .optional(),
      qrCodeGeneratedAt: z
        .union([
          z.lazy(() => SortOrderSchema),
          z.lazy(() => SortOrderInputSchema),
        ])
        .optional(),
      _count: z.lazy(() => MachineCountOrderByAggregateInputSchema).optional(),
      _max: z.lazy(() => MachineMaxOrderByAggregateInputSchema).optional(),
      _min: z.lazy(() => MachineMinOrderByAggregateInputSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.MachineOrderByWithAggregationInput>;

export default MachineOrderByWithAggregationInputSchema;
