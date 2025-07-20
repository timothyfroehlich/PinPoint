import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { StringWithAggregatesFilterSchema } from "./StringWithAggregatesFilterSchema";
import { StringNullableWithAggregatesFilterSchema } from "./StringNullableWithAggregatesFilterSchema";
import { DateTimeNullableWithAggregatesFilterSchema } from "./DateTimeNullableWithAggregatesFilterSchema";
import { DateTimeWithAggregatesFilterSchema } from "./DateTimeWithAggregatesFilterSchema";
import { BoolWithAggregatesFilterSchema } from "./BoolWithAggregatesFilterSchema";
import { EnumNotificationFrequencyWithAggregatesFilterSchema } from "./EnumNotificationFrequencyWithAggregatesFilterSchema";
import { NotificationFrequencySchema } from "./NotificationFrequencySchema";

export const UserScalarWhereWithAggregatesInputSchema: z.ZodType<Prisma.UserScalarWhereWithAggregatesInput> =
  z
    .object({
      AND: z
        .union([
          z.lazy(() => UserScalarWhereWithAggregatesInputSchema),
          z.lazy(() => UserScalarWhereWithAggregatesInputSchema).array(),
        ])
        .optional(),
      OR: z
        .lazy(() => UserScalarWhereWithAggregatesInputSchema)
        .array()
        .optional(),
      NOT: z
        .union([
          z.lazy(() => UserScalarWhereWithAggregatesInputSchema),
          z.lazy(() => UserScalarWhereWithAggregatesInputSchema).array(),
        ])
        .optional(),
      id: z
        .union([z.lazy(() => StringWithAggregatesFilterSchema), z.string()])
        .optional(),
      name: z
        .union([
          z.lazy(() => StringNullableWithAggregatesFilterSchema),
          z.string(),
        ])
        .optional()
        .nullable(),
      email: z
        .union([
          z.lazy(() => StringNullableWithAggregatesFilterSchema),
          z.string(),
        ])
        .optional()
        .nullable(),
      emailVerified: z
        .union([
          z.lazy(() => DateTimeNullableWithAggregatesFilterSchema),
          z.coerce.date(),
        ])
        .optional()
        .nullable(),
      image: z
        .union([
          z.lazy(() => StringNullableWithAggregatesFilterSchema),
          z.string(),
        ])
        .optional()
        .nullable(),
      createdAt: z
        .union([
          z.lazy(() => DateTimeWithAggregatesFilterSchema),
          z.coerce.date(),
        ])
        .optional(),
      updatedAt: z
        .union([
          z.lazy(() => DateTimeWithAggregatesFilterSchema),
          z.coerce.date(),
        ])
        .optional(),
      bio: z
        .union([
          z.lazy(() => StringNullableWithAggregatesFilterSchema),
          z.string(),
        ])
        .optional()
        .nullable(),
      profilePicture: z
        .union([
          z.lazy(() => StringNullableWithAggregatesFilterSchema),
          z.string(),
        ])
        .optional()
        .nullable(),
      emailNotificationsEnabled: z
        .union([z.lazy(() => BoolWithAggregatesFilterSchema), z.boolean()])
        .optional(),
      pushNotificationsEnabled: z
        .union([z.lazy(() => BoolWithAggregatesFilterSchema), z.boolean()])
        .optional(),
      notificationFrequency: z
        .union([
          z.lazy(() => EnumNotificationFrequencyWithAggregatesFilterSchema),
          z.lazy(() => NotificationFrequencySchema),
        ])
        .optional(),
    })
    .strict() as z.ZodType<Prisma.UserScalarWhereWithAggregatesInput>;

export default UserScalarWhereWithAggregatesInputSchema;
