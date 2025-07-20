import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { StringFieldUpdateOperationsInputSchema } from "./StringFieldUpdateOperationsInputSchema";
import { BoolFieldUpdateOperationsInputSchema } from "./BoolFieldUpdateOperationsInputSchema";
import { DateTimeFieldUpdateOperationsInputSchema } from "./DateTimeFieldUpdateOperationsInputSchema";
import { NotificationTypeSchema } from "./NotificationTypeSchema";
import { EnumNotificationTypeFieldUpdateOperationsInputSchema } from "./EnumNotificationTypeFieldUpdateOperationsInputSchema";
import { NotificationEntitySchema } from "./NotificationEntitySchema";
import { NullableEnumNotificationEntityFieldUpdateOperationsInputSchema } from "./NullableEnumNotificationEntityFieldUpdateOperationsInputSchema";
import { NullableStringFieldUpdateOperationsInputSchema } from "./NullableStringFieldUpdateOperationsInputSchema";

export const NotificationUncheckedUpdateManyWithoutUserInputSchema: z.ZodType<Prisma.NotificationUncheckedUpdateManyWithoutUserInput> =
  z
    .object({
      id: z
        .union([
          z.string().cuid(),
          z.lazy(() => StringFieldUpdateOperationsInputSchema),
        ])
        .optional(),
      message: z
        .union([
          z.string(),
          z.lazy(() => StringFieldUpdateOperationsInputSchema),
        ])
        .optional(),
      read: z
        .union([
          z.boolean(),
          z.lazy(() => BoolFieldUpdateOperationsInputSchema),
        ])
        .optional(),
      createdAt: z
        .union([
          z.coerce.date(),
          z.lazy(() => DateTimeFieldUpdateOperationsInputSchema),
        ])
        .optional(),
      type: z
        .union([
          z.lazy(() => NotificationTypeSchema),
          z.lazy(() => EnumNotificationTypeFieldUpdateOperationsInputSchema),
        ])
        .optional(),
      entityType: z
        .union([
          z.lazy(() => NotificationEntitySchema),
          z.lazy(
            () =>
              NullableEnumNotificationEntityFieldUpdateOperationsInputSchema,
          ),
        ])
        .optional()
        .nullable(),
      entityId: z
        .union([
          z.string(),
          z.lazy(() => NullableStringFieldUpdateOperationsInputSchema),
        ])
        .optional()
        .nullable(),
      actionUrl: z
        .union([
          z.string(),
          z.lazy(() => NullableStringFieldUpdateOperationsInputSchema),
        ])
        .optional()
        .nullable(),
    })
    .strict() as z.ZodType<Prisma.NotificationUncheckedUpdateManyWithoutUserInput>;

export default NotificationUncheckedUpdateManyWithoutUserInputSchema;
