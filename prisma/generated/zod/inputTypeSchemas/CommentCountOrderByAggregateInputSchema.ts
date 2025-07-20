import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { SortOrderSchema } from "./SortOrderSchema";

export const CommentCountOrderByAggregateInputSchema: z.ZodType<Prisma.CommentCountOrderByAggregateInput> =
  z
    .object({
      id: z.lazy(() => SortOrderSchema).optional(),
      content: z.lazy(() => SortOrderSchema).optional(),
      createdAt: z.lazy(() => SortOrderSchema).optional(),
      updatedAt: z.lazy(() => SortOrderSchema).optional(),
      deletedAt: z.lazy(() => SortOrderSchema).optional(),
      deletedBy: z.lazy(() => SortOrderSchema).optional(),
      issueId: z.lazy(() => SortOrderSchema).optional(),
      authorId: z.lazy(() => SortOrderSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.CommentCountOrderByAggregateInput>;

export default CommentCountOrderByAggregateInputSchema;
