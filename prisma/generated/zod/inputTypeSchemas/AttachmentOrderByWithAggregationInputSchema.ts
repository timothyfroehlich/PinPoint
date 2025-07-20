import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { SortOrderSchema } from "./SortOrderSchema";
import { AttachmentCountOrderByAggregateInputSchema } from "./AttachmentCountOrderByAggregateInputSchema";
import { AttachmentMaxOrderByAggregateInputSchema } from "./AttachmentMaxOrderByAggregateInputSchema";
import { AttachmentMinOrderByAggregateInputSchema } from "./AttachmentMinOrderByAggregateInputSchema";

export const AttachmentOrderByWithAggregationInputSchema: z.ZodType<Prisma.AttachmentOrderByWithAggregationInput> =
  z
    .object({
      id: z.lazy(() => SortOrderSchema).optional(),
      url: z.lazy(() => SortOrderSchema).optional(),
      fileName: z.lazy(() => SortOrderSchema).optional(),
      fileType: z.lazy(() => SortOrderSchema).optional(),
      createdAt: z.lazy(() => SortOrderSchema).optional(),
      organizationId: z.lazy(() => SortOrderSchema).optional(),
      issueId: z.lazy(() => SortOrderSchema).optional(),
      _count: z
        .lazy(() => AttachmentCountOrderByAggregateInputSchema)
        .optional(),
      _max: z.lazy(() => AttachmentMaxOrderByAggregateInputSchema).optional(),
      _min: z.lazy(() => AttachmentMinOrderByAggregateInputSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.AttachmentOrderByWithAggregationInput>;

export default AttachmentOrderByWithAggregationInputSchema;
