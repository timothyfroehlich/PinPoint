import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { MachineWhereInputSchema } from "./MachineWhereInputSchema";
import { StringFilterSchema } from "./StringFilterSchema";
import { StringNullableFilterSchema } from "./StringNullableFilterSchema";
import { BoolFilterSchema } from "./BoolFilterSchema";
import { DateTimeNullableFilterSchema } from "./DateTimeNullableFilterSchema";
import { OrganizationScalarRelationFilterSchema } from "./OrganizationScalarRelationFilterSchema";
import { OrganizationWhereInputSchema } from "./OrganizationWhereInputSchema";
import { LocationScalarRelationFilterSchema } from "./LocationScalarRelationFilterSchema";
import { LocationWhereInputSchema } from "./LocationWhereInputSchema";
import { ModelScalarRelationFilterSchema } from "./ModelScalarRelationFilterSchema";
import { ModelWhereInputSchema } from "./ModelWhereInputSchema";
import { UserNullableScalarRelationFilterSchema } from "./UserNullableScalarRelationFilterSchema";
import { UserWhereInputSchema } from "./UserWhereInputSchema";
import { IssueListRelationFilterSchema } from "./IssueListRelationFilterSchema";
import { CollectionListRelationFilterSchema } from "./CollectionListRelationFilterSchema";

export const MachineWhereUniqueInputSchema: z.ZodType<Prisma.MachineWhereUniqueInput> =
  z
    .union([
      z.object({
        id: z.string().cuid(),
        qrCodeId: z.string().cuid(),
      }),
      z.object({
        id: z.string().cuid(),
      }),
      z.object({
        qrCodeId: z.string().cuid(),
      }),
    ])
    .and(
      z
        .object({
          id: z.string().cuid().optional(),
          qrCodeId: z.string().cuid().optional(),
          AND: z
            .union([
              z.lazy(() => MachineWhereInputSchema),
              z.lazy(() => MachineWhereInputSchema).array(),
            ])
            .optional(),
          OR: z
            .lazy(() => MachineWhereInputSchema)
            .array()
            .optional(),
          NOT: z
            .union([
              z.lazy(() => MachineWhereInputSchema),
              z.lazy(() => MachineWhereInputSchema).array(),
            ])
            .optional(),
          name: z
            .union([z.lazy(() => StringFilterSchema), z.string()])
            .optional(),
          organizationId: z
            .union([z.lazy(() => StringFilterSchema), z.string()])
            .optional(),
          locationId: z
            .union([z.lazy(() => StringFilterSchema), z.string()])
            .optional(),
          modelId: z
            .union([z.lazy(() => StringFilterSchema), z.string()])
            .optional(),
          ownerId: z
            .union([z.lazy(() => StringNullableFilterSchema), z.string()])
            .optional()
            .nullable(),
          ownerNotificationsEnabled: z
            .union([z.lazy(() => BoolFilterSchema), z.boolean()])
            .optional(),
          notifyOnNewIssues: z
            .union([z.lazy(() => BoolFilterSchema), z.boolean()])
            .optional(),
          notifyOnStatusChanges: z
            .union([z.lazy(() => BoolFilterSchema), z.boolean()])
            .optional(),
          notifyOnComments: z
            .union([z.lazy(() => BoolFilterSchema), z.boolean()])
            .optional(),
          qrCodeUrl: z
            .union([z.lazy(() => StringNullableFilterSchema), z.string()])
            .optional()
            .nullable(),
          qrCodeGeneratedAt: z
            .union([
              z.lazy(() => DateTimeNullableFilterSchema),
              z.coerce.date(),
            ])
            .optional()
            .nullable(),
          organization: z
            .union([
              z.lazy(() => OrganizationScalarRelationFilterSchema),
              z.lazy(() => OrganizationWhereInputSchema),
            ])
            .optional(),
          location: z
            .union([
              z.lazy(() => LocationScalarRelationFilterSchema),
              z.lazy(() => LocationWhereInputSchema),
            ])
            .optional(),
          model: z
            .union([
              z.lazy(() => ModelScalarRelationFilterSchema),
              z.lazy(() => ModelWhereInputSchema),
            ])
            .optional(),
          owner: z
            .union([
              z.lazy(() => UserNullableScalarRelationFilterSchema),
              z.lazy(() => UserWhereInputSchema),
            ])
            .optional()
            .nullable(),
          issues: z.lazy(() => IssueListRelationFilterSchema).optional(),
          collections: z
            .lazy(() => CollectionListRelationFilterSchema)
            .optional(),
        })
        .strict(),
    ) as z.ZodType<Prisma.MachineWhereUniqueInput>;

export default MachineWhereUniqueInputSchema;
