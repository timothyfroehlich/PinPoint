import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { IssueStatusCreateManyInputSchema } from "../inputTypeSchemas/IssueStatusCreateManyInputSchema";

export const IssueStatusCreateManyArgsSchema: z.ZodType<Prisma.IssueStatusCreateManyArgs> =
  z
    .object({
      data: z.union([
        IssueStatusCreateManyInputSchema,
        IssueStatusCreateManyInputSchema.array(),
      ]),
      skipDuplicates: z.boolean().optional(),
    })
    .strict() as z.ZodType<Prisma.IssueStatusCreateManyArgs>;

export default IssueStatusCreateManyArgsSchema;
