import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { AttachmentIncludeSchema } from "../inputTypeSchemas/AttachmentIncludeSchema";
import { AttachmentWhereInputSchema } from "../inputTypeSchemas/AttachmentWhereInputSchema";
import { AttachmentOrderByWithRelationInputSchema } from "../inputTypeSchemas/AttachmentOrderByWithRelationInputSchema";
import { AttachmentWhereUniqueInputSchema } from "../inputTypeSchemas/AttachmentWhereUniqueInputSchema";
import { AttachmentScalarFieldEnumSchema } from "../inputTypeSchemas/AttachmentScalarFieldEnumSchema";
import { IssueArgsSchema } from "../outputTypeSchemas/IssueArgsSchema";
import { OrganizationArgsSchema } from "../outputTypeSchemas/OrganizationArgsSchema";
// Select schema needs to be in file to prevent circular imports
//------------------------------------------------------

export const AttachmentSelectSchema: z.ZodType<Prisma.AttachmentSelect> = z
  .object({
    id: z.boolean().optional(),
    url: z.boolean().optional(),
    fileName: z.boolean().optional(),
    fileType: z.boolean().optional(),
    createdAt: z.boolean().optional(),
    organizationId: z.boolean().optional(),
    issueId: z.boolean().optional(),
    issue: z.union([z.boolean(), z.lazy(() => IssueArgsSchema)]).optional(),
    organization: z
      .union([z.boolean(), z.lazy(() => OrganizationArgsSchema)])
      .optional(),
  })
  .strict();

export const AttachmentFindFirstOrThrowArgsSchema: z.ZodType<Prisma.AttachmentFindFirstOrThrowArgs> =
  z
    .object({
      select: AttachmentSelectSchema.optional(),
      include: z.lazy(() => AttachmentIncludeSchema).optional(),
      where: AttachmentWhereInputSchema.optional(),
      orderBy: z
        .union([
          AttachmentOrderByWithRelationInputSchema.array(),
          AttachmentOrderByWithRelationInputSchema,
        ])
        .optional(),
      cursor: AttachmentWhereUniqueInputSchema.optional(),
      take: z.number().optional(),
      skip: z.number().optional(),
      distinct: z
        .union([
          AttachmentScalarFieldEnumSchema,
          AttachmentScalarFieldEnumSchema.array(),
        ])
        .optional(),
    })
    .strict() as z.ZodType<Prisma.AttachmentFindFirstOrThrowArgs>;

export default AttachmentFindFirstOrThrowArgsSchema;
