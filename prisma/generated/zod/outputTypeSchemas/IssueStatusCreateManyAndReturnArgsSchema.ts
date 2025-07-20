import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { IssueStatusCreateManyInputSchema } from "../inputTypeSchemas/IssueStatusCreateManyInputSchema";

export const IssueStatusCreateManyAndReturnArgsSchema: z.ZodType<Prisma.IssueStatusCreateManyAndReturnArgs> =
  z
    .object({
      data: z.union([
        IssueStatusCreateManyInputSchema,
        IssueStatusCreateManyInputSchema.array(),
      ]),
      skipDuplicates: z.boolean().optional(),
    })
    .strict() as z.ZodType<Prisma.IssueStatusCreateManyAndReturnArgs>;

export default IssueStatusCreateManyAndReturnArgsSchema;
