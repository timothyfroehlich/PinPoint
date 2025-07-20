import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { AttachmentWhereInputSchema } from "./AttachmentWhereInputSchema";

export const AttachmentListRelationFilterSchema: z.ZodType<Prisma.AttachmentListRelationFilter> =
  z
    .object({
      every: z.lazy(() => AttachmentWhereInputSchema).optional(),
      some: z.lazy(() => AttachmentWhereInputSchema).optional(),
      none: z.lazy(() => AttachmentWhereInputSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.AttachmentListRelationFilter>;

export default AttachmentListRelationFilterSchema;
