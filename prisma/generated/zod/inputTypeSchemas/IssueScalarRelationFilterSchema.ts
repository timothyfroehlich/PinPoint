import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { IssueWhereInputSchema } from "./IssueWhereInputSchema";

export const IssueScalarRelationFilterSchema: z.ZodType<Prisma.IssueScalarRelationFilter> =
  z
    .object({
      is: z.lazy(() => IssueWhereInputSchema).optional(),
      isNot: z.lazy(() => IssueWhereInputSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.IssueScalarRelationFilter>;

export default IssueScalarRelationFilterSchema;
