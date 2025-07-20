import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { IssueStatusNameOrganizationIdCompoundUniqueInputSchema } from "./IssueStatusNameOrganizationIdCompoundUniqueInputSchema";
import { IssueStatusWhereInputSchema } from "./IssueStatusWhereInputSchema";
import { StringFilterSchema } from "./StringFilterSchema";
import { EnumStatusCategoryFilterSchema } from "./EnumStatusCategoryFilterSchema";
import { StatusCategorySchema } from "./StatusCategorySchema";
import { BoolFilterSchema } from "./BoolFilterSchema";
import { OrganizationScalarRelationFilterSchema } from "./OrganizationScalarRelationFilterSchema";
import { OrganizationWhereInputSchema } from "./OrganizationWhereInputSchema";
import { IssueListRelationFilterSchema } from "./IssueListRelationFilterSchema";

export const IssueStatusWhereUniqueInputSchema: z.ZodType<Prisma.IssueStatusWhereUniqueInput> =
  z
    .union([
      z.object({
        id: z.string().cuid(),
        name_organizationId: z.lazy(
          () => IssueStatusNameOrganizationIdCompoundUniqueInputSchema,
        ),
      }),
      z.object({
        id: z.string().cuid(),
      }),
      z.object({
        name_organizationId: z.lazy(
          () => IssueStatusNameOrganizationIdCompoundUniqueInputSchema,
        ),
      }),
    ])
    .and(
      z
        .object({
          id: z.string().cuid().optional(),
          name_organizationId: z
            .lazy(() => IssueStatusNameOrganizationIdCompoundUniqueInputSchema)
            .optional(),
          AND: z
            .union([
              z.lazy(() => IssueStatusWhereInputSchema),
              z.lazy(() => IssueStatusWhereInputSchema).array(),
            ])
            .optional(),
          OR: z
            .lazy(() => IssueStatusWhereInputSchema)
            .array()
            .optional(),
          NOT: z
            .union([
              z.lazy(() => IssueStatusWhereInputSchema),
              z.lazy(() => IssueStatusWhereInputSchema).array(),
            ])
            .optional(),
          name: z
            .union([z.lazy(() => StringFilterSchema), z.string()])
            .optional(),
          category: z
            .union([
              z.lazy(() => EnumStatusCategoryFilterSchema),
              z.lazy(() => StatusCategorySchema),
            ])
            .optional(),
          organizationId: z
            .union([z.lazy(() => StringFilterSchema), z.string()])
            .optional(),
          isDefault: z
            .union([z.lazy(() => BoolFilterSchema), z.boolean()])
            .optional(),
          organization: z
            .union([
              z.lazy(() => OrganizationScalarRelationFilterSchema),
              z.lazy(() => OrganizationWhereInputSchema),
            ])
            .optional(),
          issues: z.lazy(() => IssueListRelationFilterSchema).optional(),
        })
        .strict(),
    ) as z.ZodType<Prisma.IssueStatusWhereUniqueInput>;

export default IssueStatusWhereUniqueInputSchema;
