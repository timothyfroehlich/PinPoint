import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { StringFilterSchema } from "./StringFilterSchema";
import { BoolFilterSchema } from "./BoolFilterSchema";
import { DateTimeFilterSchema } from "./DateTimeFilterSchema";
import { EnumNotificationTypeFilterSchema } from "./EnumNotificationTypeFilterSchema";
import { NotificationTypeSchema } from "./NotificationTypeSchema";
import { EnumNotificationEntityNullableFilterSchema } from "./EnumNotificationEntityNullableFilterSchema";
import { NotificationEntitySchema } from "./NotificationEntitySchema";
import { StringNullableFilterSchema } from "./StringNullableFilterSchema";
import { UserScalarRelationFilterSchema } from "./UserScalarRelationFilterSchema";
import { UserWhereInputSchema } from "./UserWhereInputSchema";

export const NotificationWhereInputSchema: z.ZodType<Prisma.NotificationWhereInput> =
  z
    .object({
      AND: z
        .union([
          z.lazy(() => NotificationWhereInputSchema),
          z.lazy(() => NotificationWhereInputSchema).array(),
        ])
        .optional(),
      OR: z
        .lazy(() => NotificationWhereInputSchema)
        .array()
        .optional(),
      NOT: z
        .union([
          z.lazy(() => NotificationWhereInputSchema),
          z.lazy(() => NotificationWhereInputSchema).array(),
        ])
        .optional(),
      id: z.union([z.lazy(() => StringFilterSchema), z.string()]).optional(),
      message: z
        .union([z.lazy(() => StringFilterSchema), z.string()])
        .optional(),
      read: z.union([z.lazy(() => BoolFilterSchema), z.boolean()]).optional(),
      createdAt: z
        .union([z.lazy(() => DateTimeFilterSchema), z.coerce.date()])
        .optional(),
      userId: z
        .union([z.lazy(() => StringFilterSchema), z.string()])
        .optional(),
      type: z
        .union([
          z.lazy(() => EnumNotificationTypeFilterSchema),
          z.lazy(() => NotificationTypeSchema),
        ])
        .optional(),
      entityType: z
        .union([
          z.lazy(() => EnumNotificationEntityNullableFilterSchema),
          z.lazy(() => NotificationEntitySchema),
        ])
        .optional()
        .nullable(),
      entityId: z
        .union([z.lazy(() => StringNullableFilterSchema), z.string()])
        .optional()
        .nullable(),
      actionUrl: z
        .union([z.lazy(() => StringNullableFilterSchema), z.string()])
        .optional()
        .nullable(),
      user: z
        .union([
          z.lazy(() => UserScalarRelationFilterSchema),
          z.lazy(() => UserWhereInputSchema),
        ])
        .optional(),
    })
    .strict() as z.ZodType<Prisma.NotificationWhereInput>;

export default NotificationWhereInputSchema;
