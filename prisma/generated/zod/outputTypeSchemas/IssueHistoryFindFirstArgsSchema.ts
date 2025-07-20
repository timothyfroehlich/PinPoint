import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { IssueHistoryIncludeSchema } from "../inputTypeSchemas/IssueHistoryIncludeSchema";
import { IssueHistoryWhereInputSchema } from "../inputTypeSchemas/IssueHistoryWhereInputSchema";
import { IssueHistoryOrderByWithRelationInputSchema } from "../inputTypeSchemas/IssueHistoryOrderByWithRelationInputSchema";
import { IssueHistoryWhereUniqueInputSchema } from "../inputTypeSchemas/IssueHistoryWhereUniqueInputSchema";
import { IssueHistoryScalarFieldEnumSchema } from "../inputTypeSchemas/IssueHistoryScalarFieldEnumSchema";
import { IssueArgsSchema } from "../outputTypeSchemas/IssueArgsSchema";
import { OrganizationArgsSchema } from "../outputTypeSchemas/OrganizationArgsSchema";
import { UserArgsSchema } from "../outputTypeSchemas/UserArgsSchema";
// Select schema needs to be in file to prevent circular imports
//------------------------------------------------------

export const IssueHistorySelectSchema: z.ZodType<Prisma.IssueHistorySelect> = z
  .object({
    id: z.boolean().optional(),
    field: z.boolean().optional(),
    oldValue: z.boolean().optional(),
    newValue: z.boolean().optional(),
    changedAt: z.boolean().optional(),
    organizationId: z.boolean().optional(),
    actorId: z.boolean().optional(),
    type: z.boolean().optional(),
    issueId: z.boolean().optional(),
    issue: z.union([z.boolean(), z.lazy(() => IssueArgsSchema)]).optional(),
    organization: z
      .union([z.boolean(), z.lazy(() => OrganizationArgsSchema)])
      .optional(),
    actor: z.union([z.boolean(), z.lazy(() => UserArgsSchema)]).optional(),
  })
  .strict();

export const IssueHistoryFindFirstArgsSchema: z.ZodType<Prisma.IssueHistoryFindFirstArgs> =
  z
    .object({
      select: IssueHistorySelectSchema.optional(),
      include: z.lazy(() => IssueHistoryIncludeSchema).optional(),
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
      distinct: z
        .union([
          IssueHistoryScalarFieldEnumSchema,
          IssueHistoryScalarFieldEnumSchema.array(),
        ])
        .optional(),
    })
    .strict() as z.ZodType<Prisma.IssueHistoryFindFirstArgs>;

export default IssueHistoryFindFirstArgsSchema;
