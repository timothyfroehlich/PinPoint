import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { IssueStatusWhereInputSchema } from "./IssueStatusWhereInputSchema";

export const IssueStatusListRelationFilterSchema: z.ZodType<Prisma.IssueStatusListRelationFilter> =
  z
    .object({
      every: z.lazy(() => IssueStatusWhereInputSchema).optional(),
      some: z.lazy(() => IssueStatusWhereInputSchema).optional(),
      none: z.lazy(() => IssueStatusWhereInputSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.IssueStatusListRelationFilter>;

export default IssueStatusListRelationFilterSchema;
