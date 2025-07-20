import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { SortOrderSchema } from "./SortOrderSchema";

export const IssueStatusMinOrderByAggregateInputSchema: z.ZodType<Prisma.IssueStatusMinOrderByAggregateInput> =
  z
    .object({
      id: z.lazy(() => SortOrderSchema).optional(),
      name: z.lazy(() => SortOrderSchema).optional(),
      category: z.lazy(() => SortOrderSchema).optional(),
      organizationId: z.lazy(() => SortOrderSchema).optional(),
      isDefault: z.lazy(() => SortOrderSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.IssueStatusMinOrderByAggregateInput>;

export default IssueStatusMinOrderByAggregateInputSchema;
