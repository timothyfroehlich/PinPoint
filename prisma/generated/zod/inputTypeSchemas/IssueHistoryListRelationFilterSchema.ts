import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { IssueHistoryWhereInputSchema } from "./IssueHistoryWhereInputSchema";

export const IssueHistoryListRelationFilterSchema: z.ZodType<Prisma.IssueHistoryListRelationFilter> =
  z
    .object({
      every: z.lazy(() => IssueHistoryWhereInputSchema).optional(),
      some: z.lazy(() => IssueHistoryWhereInputSchema).optional(),
      none: z.lazy(() => IssueHistoryWhereInputSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.IssueHistoryListRelationFilter>;

export default IssueHistoryListRelationFilterSchema;
