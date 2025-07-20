import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { IssueStatusWhereInputSchema } from "../inputTypeSchemas/IssueStatusWhereInputSchema";
import { IssueStatusOrderByWithAggregationInputSchema } from "../inputTypeSchemas/IssueStatusOrderByWithAggregationInputSchema";
import { IssueStatusScalarFieldEnumSchema } from "../inputTypeSchemas/IssueStatusScalarFieldEnumSchema";
import { IssueStatusScalarWhereWithAggregatesInputSchema } from "../inputTypeSchemas/IssueStatusScalarWhereWithAggregatesInputSchema";

export const IssueStatusGroupByArgsSchema: z.ZodType<Prisma.IssueStatusGroupByArgs> =
  z
    .object({
      where: IssueStatusWhereInputSchema.optional(),
      orderBy: z
        .union([
          IssueStatusOrderByWithAggregationInputSchema.array(),
          IssueStatusOrderByWithAggregationInputSchema,
        ])
        .optional(),
      by: IssueStatusScalarFieldEnumSchema.array(),
      having: IssueStatusScalarWhereWithAggregatesInputSchema.optional(),
      take: z.number().optional(),
      skip: z.number().optional(),
    })
    .strict() as z.ZodType<Prisma.IssueStatusGroupByArgs>;

export default IssueStatusGroupByArgsSchema;
