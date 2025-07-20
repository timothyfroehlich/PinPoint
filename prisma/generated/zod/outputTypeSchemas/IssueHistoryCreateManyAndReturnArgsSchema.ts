import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { IssueHistoryCreateManyInputSchema } from "../inputTypeSchemas/IssueHistoryCreateManyInputSchema";

export const IssueHistoryCreateManyAndReturnArgsSchema: z.ZodType<Prisma.IssueHistoryCreateManyAndReturnArgs> =
  z
    .object({
      data: z.union([
        IssueHistoryCreateManyInputSchema,
        IssueHistoryCreateManyInputSchema.array(),
      ]),
      skipDuplicates: z.boolean().optional(),
    })
    .strict() as z.ZodType<Prisma.IssueHistoryCreateManyAndReturnArgs>;

export default IssueHistoryCreateManyAndReturnArgsSchema;
