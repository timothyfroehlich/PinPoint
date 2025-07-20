import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { NotificationFrequencySchema } from "./NotificationFrequencySchema";

export const EnumNotificationFrequencyFieldUpdateOperationsInputSchema: z.ZodType<Prisma.EnumNotificationFrequencyFieldUpdateOperationsInput> =
  z
    .object({
      set: z.lazy(() => NotificationFrequencySchema).optional(),
    })
    .strict() as z.ZodType<Prisma.EnumNotificationFrequencyFieldUpdateOperationsInput>;

export default EnumNotificationFrequencyFieldUpdateOperationsInputSchema;
