import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { PriorityNameOrganizationIdCompoundUniqueInputSchema } from "./PriorityNameOrganizationIdCompoundUniqueInputSchema";
import { PriorityWhereInputSchema } from "./PriorityWhereInputSchema";
import { StringFilterSchema } from "./StringFilterSchema";
import { IntFilterSchema } from "./IntFilterSchema";
import { BoolFilterSchema } from "./BoolFilterSchema";
import { OrganizationScalarRelationFilterSchema } from "./OrganizationScalarRelationFilterSchema";
import { OrganizationWhereInputSchema } from "./OrganizationWhereInputSchema";
import { IssueListRelationFilterSchema } from "./IssueListRelationFilterSchema";

export const PriorityWhereUniqueInputSchema: z.ZodType<Prisma.PriorityWhereUniqueInput> =
  z
    .union([
      z.object({
        id: z.string().cuid(),
        name_organizationId: z.lazy(
          () => PriorityNameOrganizationIdCompoundUniqueInputSchema,
        ),
      }),
      z.object({
        id: z.string().cuid(),
      }),
      z.object({
        name_organizationId: z.lazy(
          () => PriorityNameOrganizationIdCompoundUniqueInputSchema,
        ),
      }),
    ])
    .and(
      z
        .object({
          id: z.string().cuid().optional(),
          name_organizationId: z
            .lazy(() => PriorityNameOrganizationIdCompoundUniqueInputSchema)
            .optional(),
          AND: z
            .union([
              z.lazy(() => PriorityWhereInputSchema),
              z.lazy(() => PriorityWhereInputSchema).array(),
            ])
            .optional(),
          OR: z
            .lazy(() => PriorityWhereInputSchema)
            .array()
            .optional(),
          NOT: z
            .union([
              z.lazy(() => PriorityWhereInputSchema),
              z.lazy(() => PriorityWhereInputSchema).array(),
            ])
            .optional(),
          name: z
            .union([z.lazy(() => StringFilterSchema), z.string()])
            .optional(),
          order: z
            .union([z.lazy(() => IntFilterSchema), z.number().int()])
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
    ) as z.ZodType<Prisma.PriorityWhereUniqueInput>;

export default PriorityWhereUniqueInputSchema;
