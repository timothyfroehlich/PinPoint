import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { SortOrderSchema } from "./SortOrderSchema";

export const AttachmentOrderByRelationAggregateInputSchema: z.ZodType<Prisma.AttachmentOrderByRelationAggregateInput> =
  z
    .object({
      _count: z.lazy(() => SortOrderSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.AttachmentOrderByRelationAggregateInput>;

export default AttachmentOrderByRelationAggregateInputSchema;
