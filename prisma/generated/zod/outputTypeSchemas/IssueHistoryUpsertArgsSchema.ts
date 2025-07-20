import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { IssueHistoryIncludeSchema } from "../inputTypeSchemas/IssueHistoryIncludeSchema";
import { IssueHistoryWhereUniqueInputSchema } from "../inputTypeSchemas/IssueHistoryWhereUniqueInputSchema";
import { IssueHistoryCreateInputSchema } from "../inputTypeSchemas/IssueHistoryCreateInputSchema";
import { IssueHistoryUncheckedCreateInputSchema } from "../inputTypeSchemas/IssueHistoryUncheckedCreateInputSchema";
import { IssueHistoryUpdateInputSchema } from "../inputTypeSchemas/IssueHistoryUpdateInputSchema";
import { IssueHistoryUncheckedUpdateInputSchema } from "../inputTypeSchemas/IssueHistoryUncheckedUpdateInputSchema";
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

export const IssueHistoryUpsertArgsSchema: z.ZodType<Prisma.IssueHistoryUpsertArgs> =
  z
    .object({
      select: IssueHistorySelectSchema.optional(),
      include: z.lazy(() => IssueHistoryIncludeSchema).optional(),
      where: IssueHistoryWhereUniqueInputSchema,
      create: z.union([
        IssueHistoryCreateInputSchema,
        IssueHistoryUncheckedCreateInputSchema,
      ]),
      update: z.union([
        IssueHistoryUpdateInputSchema,
        IssueHistoryUncheckedUpdateInputSchema,
      ]),
    })
    .strict() as z.ZodType<Prisma.IssueHistoryUpsertArgs>;

export default IssueHistoryUpsertArgsSchema;
