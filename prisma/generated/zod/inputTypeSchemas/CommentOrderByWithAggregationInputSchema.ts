import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { SortOrderSchema } from "./SortOrderSchema";
import { SortOrderInputSchema } from "./SortOrderInputSchema";
import { CommentCountOrderByAggregateInputSchema } from "./CommentCountOrderByAggregateInputSchema";
import { CommentMaxOrderByAggregateInputSchema } from "./CommentMaxOrderByAggregateInputSchema";
import { CommentMinOrderByAggregateInputSchema } from "./CommentMinOrderByAggregateInputSchema";

export const CommentOrderByWithAggregationInputSchema: z.ZodType<Prisma.CommentOrderByWithAggregationInput> =
  z
    .object({
      id: z.lazy(() => SortOrderSchema).optional(),
      content: z.lazy(() => SortOrderSchema).optional(),
      createdAt: z.lazy(() => SortOrderSchema).optional(),
      updatedAt: z.lazy(() => SortOrderSchema).optional(),
      deletedAt: z
        .union([
          z.lazy(() => SortOrderSchema),
          z.lazy(() => SortOrderInputSchema),
        ])
        .optional(),
      deletedBy: z
        .union([
          z.lazy(() => SortOrderSchema),
          z.lazy(() => SortOrderInputSchema),
        ])
        .optional(),
      issueId: z.lazy(() => SortOrderSchema).optional(),
      authorId: z.lazy(() => SortOrderSchema).optional(),
      _count: z.lazy(() => CommentCountOrderByAggregateInputSchema).optional(),
      _max: z.lazy(() => CommentMaxOrderByAggregateInputSchema).optional(),
      _min: z.lazy(() => CommentMinOrderByAggregateInputSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.CommentOrderByWithAggregationInput>;

export default CommentOrderByWithAggregationInputSchema;
