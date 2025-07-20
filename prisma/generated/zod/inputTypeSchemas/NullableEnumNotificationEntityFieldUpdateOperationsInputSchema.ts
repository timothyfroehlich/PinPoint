import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { NotificationEntitySchema } from "./NotificationEntitySchema";

export const NullableEnumNotificationEntityFieldUpdateOperationsInputSchema: z.ZodType<Prisma.NullableEnumNotificationEntityFieldUpdateOperationsInput> =
  z
    .object({
      set: z
        .lazy(() => NotificationEntitySchema)
        .optional()
        .nullable(),
    })
    .strict() as z.ZodType<Prisma.NullableEnumNotificationEntityFieldUpdateOperationsInput>;

export default NullableEnumNotificationEntityFieldUpdateOperationsInputSchema;
