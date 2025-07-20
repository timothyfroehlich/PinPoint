import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { IssueHistoryWhereInputSchema } from "../inputTypeSchemas/IssueHistoryWhereInputSchema";
import { IssueHistoryOrderByWithRelationInputSchema } from "../inputTypeSchemas/IssueHistoryOrderByWithRelationInputSchema";
import { IssueHistoryWhereUniqueInputSchema } from "../inputTypeSchemas/IssueHistoryWhereUniqueInputSchema";

export const IssueHistoryAggregateArgsSchema: z.ZodType<Prisma.IssueHistoryAggregateArgs> =
  z
    .object({
      where: IssueHistoryWhereInputSchema.optional(),
      orderBy: z
        .union([
          IssueHistoryOrderByWithRelationInputSchema.array(),
          IssueHistoryOrderByWithRelationInputSchema,
        ])
        .optional(),
      cursor: IssueHistoryWhereUniqueInputSchema.optional(),
      take: z.number().optional(),
      skip: z.number().optional(),
    })
    .strict() as z.ZodType<Prisma.IssueHistoryAggregateArgs>;

export default IssueHistoryAggregateArgsSchema;
