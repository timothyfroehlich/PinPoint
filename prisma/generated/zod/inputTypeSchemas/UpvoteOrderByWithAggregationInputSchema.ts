import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { SortOrderSchema } from "./SortOrderSchema";
import { UpvoteCountOrderByAggregateInputSchema } from "./UpvoteCountOrderByAggregateInputSchema";
import { UpvoteMaxOrderByAggregateInputSchema } from "./UpvoteMaxOrderByAggregateInputSchema";
import { UpvoteMinOrderByAggregateInputSchema } from "./UpvoteMinOrderByAggregateInputSchema";

export const UpvoteOrderByWithAggregationInputSchema: z.ZodType<Prisma.UpvoteOrderByWithAggregationInput> =
  z
    .object({
      id: z.lazy(() => SortOrderSchema).optional(),
      createdAt: z.lazy(() => SortOrderSchema).optional(),
      issueId: z.lazy(() => SortOrderSchema).optional(),
      userId: z.lazy(() => SortOrderSchema).optional(),
      _count: z.lazy(() => UpvoteCountOrderByAggregateInputSchema).optional(),
      _max: z.lazy(() => UpvoteMaxOrderByAggregateInputSchema).optional(),
      _min: z.lazy(() => UpvoteMinOrderByAggregateInputSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.UpvoteOrderByWithAggregationInput>;

export default UpvoteOrderByWithAggregationInputSchema;
