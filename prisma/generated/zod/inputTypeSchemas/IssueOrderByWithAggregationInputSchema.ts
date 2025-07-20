import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { SortOrderSchema } from "./SortOrderSchema";
import { SortOrderInputSchema } from "./SortOrderInputSchema";
import { IssueCountOrderByAggregateInputSchema } from "./IssueCountOrderByAggregateInputSchema";
import { IssueMaxOrderByAggregateInputSchema } from "./IssueMaxOrderByAggregateInputSchema";
import { IssueMinOrderByAggregateInputSchema } from "./IssueMinOrderByAggregateInputSchema";

export const IssueOrderByWithAggregationInputSchema: z.ZodType<Prisma.IssueOrderByWithAggregationInput> =
  z
    .object({
      id: z.lazy(() => SortOrderSchema).optional(),
      title: z.lazy(() => SortOrderSchema).optional(),
      description: z
        .union([
          z.lazy(() => SortOrderSchema),
          z.lazy(() => SortOrderInputSchema),
        ])
        .optional(),
      consistency: z
        .union([
          z.lazy(() => SortOrderSchema),
          z.lazy(() => SortOrderInputSchema),
        ])
        .optional(),
      checklist: z
        .union([
          z.lazy(() => SortOrderSchema),
          z.lazy(() => SortOrderInputSchema),
        ])
        .optional(),
      createdAt: z.lazy(() => SortOrderSchema).optional(),
      updatedAt: z.lazy(() => SortOrderSchema).optional(),
      resolvedAt: z
        .union([
          z.lazy(() => SortOrderSchema),
          z.lazy(() => SortOrderInputSchema),
        ])
        .optional(),
      organizationId: z.lazy(() => SortOrderSchema).optional(),
      machineId: z.lazy(() => SortOrderSchema).optional(),
      statusId: z.lazy(() => SortOrderSchema).optional(),
      priorityId: z.lazy(() => SortOrderSchema).optional(),
      createdById: z.lazy(() => SortOrderSchema).optional(),
      assignedToId: z
        .union([
          z.lazy(() => SortOrderSchema),
          z.lazy(() => SortOrderInputSchema),
        ])
        .optional(),
      _count: z.lazy(() => IssueCountOrderByAggregateInputSchema).optional(),
      _max: z.lazy(() => IssueMaxOrderByAggregateInputSchema).optional(),
      _min: z.lazy(() => IssueMinOrderByAggregateInputSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.IssueOrderByWithAggregationInput>;

export default IssueOrderByWithAggregationInputSchema;
