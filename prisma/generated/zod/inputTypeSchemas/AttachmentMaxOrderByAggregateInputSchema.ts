import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { SortOrderSchema } from "./SortOrderSchema";

export const AttachmentMaxOrderByAggregateInputSchema: z.ZodType<Prisma.AttachmentMaxOrderByAggregateInput> =
  z
    .object({
      id: z.lazy(() => SortOrderSchema).optional(),
      url: z.lazy(() => SortOrderSchema).optional(),
      fileName: z.lazy(() => SortOrderSchema).optional(),
      fileType: z.lazy(() => SortOrderSchema).optional(),
      createdAt: z.lazy(() => SortOrderSchema).optional(),
      organizationId: z.lazy(() => SortOrderSchema).optional(),
      issueId: z.lazy(() => SortOrderSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.AttachmentMaxOrderByAggregateInput>;

export default AttachmentMaxOrderByAggregateInputSchema;
