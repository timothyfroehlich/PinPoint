import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { IssueWhereInputSchema } from "../inputTypeSchemas/IssueWhereInputSchema";
import { IssueOrderByWithRelationInputSchema } from "../inputTypeSchemas/IssueOrderByWithRelationInputSchema";
import { IssueWhereUniqueInputSchema } from "../inputTypeSchemas/IssueWhereUniqueInputSchema";

export const IssueAggregateArgsSchema: z.ZodType<Prisma.IssueAggregateArgs> = z
  .object({
    where: IssueWhereInputSchema.optional(),
    orderBy: z
      .union([
        IssueOrderByWithRelationInputSchema.array(),
        IssueOrderByWithRelationInputSchema,
      ])
      .optional(),
    cursor: IssueWhereUniqueInputSchema.optional(),
    take: z.number().optional(),
    skip: z.number().optional(),
  })
  .strict() as z.ZodType<Prisma.IssueAggregateArgs>;

export default IssueAggregateArgsSchema;
