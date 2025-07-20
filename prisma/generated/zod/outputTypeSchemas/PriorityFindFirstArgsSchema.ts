import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { PriorityIncludeSchema } from "../inputTypeSchemas/PriorityIncludeSchema";
import { PriorityWhereInputSchema } from "../inputTypeSchemas/PriorityWhereInputSchema";
import { PriorityOrderByWithRelationInputSchema } from "../inputTypeSchemas/PriorityOrderByWithRelationInputSchema";
import { PriorityWhereUniqueInputSchema } from "../inputTypeSchemas/PriorityWhereUniqueInputSchema";
import { PriorityScalarFieldEnumSchema } from "../inputTypeSchemas/PriorityScalarFieldEnumSchema";
import { OrganizationArgsSchema } from "../outputTypeSchemas/OrganizationArgsSchema";
import { IssueFindManyArgsSchema } from "../outputTypeSchemas/IssueFindManyArgsSchema";
import { PriorityCountOutputTypeArgsSchema } from "../outputTypeSchemas/PriorityCountOutputTypeArgsSchema";
// Select schema needs to be in file to prevent circular imports
//------------------------------------------------------

export const PrioritySelectSchema: z.ZodType<Prisma.PrioritySelect> = z
  .object({
    id: z.boolean().optional(),
    name: z.boolean().optional(),
    order: z.boolean().optional(),
    organizationId: z.boolean().optional(),
    isDefault: z.boolean().optional(),
    organization: z
      .union([z.boolean(), z.lazy(() => OrganizationArgsSchema)])
      .optional(),
    issues: z
      .union([z.boolean(), z.lazy(() => IssueFindManyArgsSchema)])
      .optional(),
    _count: z
      .union([z.boolean(), z.lazy(() => PriorityCountOutputTypeArgsSchema)])
      .optional(),
  })
  .strict();

export const PriorityFindFirstArgsSchema: z.ZodType<Prisma.PriorityFindFirstArgs> =
  z
    .object({
      select: PrioritySelectSchema.optional(),
      include: z.lazy(() => PriorityIncludeSchema).optional(),
      where: PriorityWhereInputSchema.optional(),
      orderBy: z
        .union([
          PriorityOrderByWithRelationInputSchema.array(),
          PriorityOrderByWithRelationInputSchema,
        ])
        .optional(),
      cursor: PriorityWhereUniqueInputSchema.optional(),
      take: z.number().optional(),
      skip: z.number().optional(),
      distinct: z
        .union([
          PriorityScalarFieldEnumSchema,
          PriorityScalarFieldEnumSchema.array(),
        ])
        .optional(),
    })
    .strict() as z.ZodType<Prisma.PriorityFindFirstArgs>;

export default PriorityFindFirstArgsSchema;
