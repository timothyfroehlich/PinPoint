import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { IssueStatusIncludeSchema } from "../inputTypeSchemas/IssueStatusIncludeSchema";
import { IssueStatusWhereInputSchema } from "../inputTypeSchemas/IssueStatusWhereInputSchema";
import { IssueStatusOrderByWithRelationInputSchema } from "../inputTypeSchemas/IssueStatusOrderByWithRelationInputSchema";
import { IssueStatusWhereUniqueInputSchema } from "../inputTypeSchemas/IssueStatusWhereUniqueInputSchema";
import { IssueStatusScalarFieldEnumSchema } from "../inputTypeSchemas/IssueStatusScalarFieldEnumSchema";
import { OrganizationArgsSchema } from "../outputTypeSchemas/OrganizationArgsSchema";
import { IssueFindManyArgsSchema } from "../outputTypeSchemas/IssueFindManyArgsSchema";
import { IssueStatusCountOutputTypeArgsSchema } from "../outputTypeSchemas/IssueStatusCountOutputTypeArgsSchema";
// Select schema needs to be in file to prevent circular imports
//------------------------------------------------------

export const IssueStatusSelectSchema: z.ZodType<Prisma.IssueStatusSelect> = z
  .object({
    id: z.boolean().optional(),
    name: z.boolean().optional(),
    category: z.boolean().optional(),
    organizationId: z.boolean().optional(),
    isDefault: z.boolean().optional(),
    organization: z
      .union([z.boolean(), z.lazy(() => OrganizationArgsSchema)])
      .optional(),
    issues: z
      .union([z.boolean(), z.lazy(() => IssueFindManyArgsSchema)])
      .optional(),
    _count: z
      .union([z.boolean(), z.lazy(() => IssueStatusCountOutputTypeArgsSchema)])
      .optional(),
  })
  .strict();

export const IssueStatusFindFirstOrThrowArgsSchema: z.ZodType<Prisma.IssueStatusFindFirstOrThrowArgs> =
  z
    .object({
      select: IssueStatusSelectSchema.optional(),
      include: z.lazy(() => IssueStatusIncludeSchema).optional(),
      where: IssueStatusWhereInputSchema.optional(),
      orderBy: z
        .union([
          IssueStatusOrderByWithRelationInputSchema.array(),
          IssueStatusOrderByWithRelationInputSchema,
        ])
        .optional(),
      cursor: IssueStatusWhereUniqueInputSchema.optional(),
      take: z.number().optional(),
      skip: z.number().optional(),
      distinct: z
        .union([
          IssueStatusScalarFieldEnumSchema,
          IssueStatusScalarFieldEnumSchema.array(),
        ])
        .optional(),
    })
    .strict() as z.ZodType<Prisma.IssueStatusFindFirstOrThrowArgs>;

export default IssueStatusFindFirstOrThrowArgsSchema;
