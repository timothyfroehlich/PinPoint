import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { IssueStatusWhereInputSchema } from "./IssueStatusWhereInputSchema";

export const IssueStatusScalarRelationFilterSchema: z.ZodType<Prisma.IssueStatusScalarRelationFilter> =
  z
    .object({
      is: z.lazy(() => IssueStatusWhereInputSchema).optional(),
      isNot: z.lazy(() => IssueStatusWhereInputSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.IssueStatusScalarRelationFilter>;

export default IssueStatusScalarRelationFilterSchema;
