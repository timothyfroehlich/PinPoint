import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { IssueHistoryCreateManyInputSchema } from "../inputTypeSchemas/IssueHistoryCreateManyInputSchema";

export const IssueHistoryCreateManyArgsSchema: z.ZodType<Prisma.IssueHistoryCreateManyArgs> =
  z
    .object({
      data: z.union([
        IssueHistoryCreateManyInputSchema,
        IssueHistoryCreateManyInputSchema.array(),
      ]),
      skipDuplicates: z.boolean().optional(),
    })
    .strict() as z.ZodType<Prisma.IssueHistoryCreateManyArgs>;

export default IssueHistoryCreateManyArgsSchema;
