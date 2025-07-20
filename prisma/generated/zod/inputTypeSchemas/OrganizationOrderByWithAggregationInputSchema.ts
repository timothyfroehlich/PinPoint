import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { SortOrderSchema } from "./SortOrderSchema";
import { SortOrderInputSchema } from "./SortOrderInputSchema";
import { OrganizationCountOrderByAggregateInputSchema } from "./OrganizationCountOrderByAggregateInputSchema";
import { OrganizationMaxOrderByAggregateInputSchema } from "./OrganizationMaxOrderByAggregateInputSchema";
import { OrganizationMinOrderByAggregateInputSchema } from "./OrganizationMinOrderByAggregateInputSchema";

export const OrganizationOrderByWithAggregationInputSchema: z.ZodType<Prisma.OrganizationOrderByWithAggregationInput> =
  z
    .object({
      id: z.lazy(() => SortOrderSchema).optional(),
      name: z.lazy(() => SortOrderSchema).optional(),
      subdomain: z
        .union([
          z.lazy(() => SortOrderSchema),
          z.lazy(() => SortOrderInputSchema),
        ])
        .optional(),
      logoUrl: z
        .union([
          z.lazy(() => SortOrderSchema),
          z.lazy(() => SortOrderInputSchema),
        ])
        .optional(),
      createdAt: z.lazy(() => SortOrderSchema).optional(),
      updatedAt: z.lazy(() => SortOrderSchema).optional(),
      _count: z
        .lazy(() => OrganizationCountOrderByAggregateInputSchema)
        .optional(),
      _max: z.lazy(() => OrganizationMaxOrderByAggregateInputSchema).optional(),
      _min: z.lazy(() => OrganizationMinOrderByAggregateInputSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.OrganizationOrderByWithAggregationInput>;

export default OrganizationOrderByWithAggregationInputSchema;
