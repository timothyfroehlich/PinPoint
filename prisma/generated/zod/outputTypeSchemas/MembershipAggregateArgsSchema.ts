import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { MembershipWhereInputSchema } from "../inputTypeSchemas/MembershipWhereInputSchema";
import { MembershipOrderByWithRelationInputSchema } from "../inputTypeSchemas/MembershipOrderByWithRelationInputSchema";
import { MembershipWhereUniqueInputSchema } from "../inputTypeSchemas/MembershipWhereUniqueInputSchema";

export const MembershipAggregateArgsSchema: z.ZodType<Prisma.MembershipAggregateArgs> =
  z
    .object({
      where: MembershipWhereInputSchema.optional(),
      orderBy: z
        .union([
          MembershipOrderByWithRelationInputSchema.array(),
          MembershipOrderByWithRelationInputSchema,
        ])
        .optional(),
      cursor: MembershipWhereUniqueInputSchema.optional(),
      take: z.number().optional(),
      skip: z.number().optional(),
    })
    .strict() as z.ZodType<Prisma.MembershipAggregateArgs>;

export default MembershipAggregateArgsSchema;
