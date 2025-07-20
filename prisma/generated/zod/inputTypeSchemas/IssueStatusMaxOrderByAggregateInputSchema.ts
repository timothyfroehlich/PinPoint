import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { SortOrderSchema } from "./SortOrderSchema";

export const IssueStatusMaxOrderByAggregateInputSchema: z.ZodType<Prisma.IssueStatusMaxOrderByAggregateInput> =
  z
    .object({
      id: z.lazy(() => SortOrderSchema).optional(),
      name: z.lazy(() => SortOrderSchema).optional(),
      category: z.lazy(() => SortOrderSchema).optional(),
      organizationId: z.lazy(() => SortOrderSchema).optional(),
      isDefault: z.lazy(() => SortOrderSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.IssueStatusMaxOrderByAggregateInput>;

export default IssueStatusMaxOrderByAggregateInputSchema;
