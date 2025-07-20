import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { ActivityTypeSchema } from "./ActivityTypeSchema";

export const EnumActivityTypeFieldUpdateOperationsInputSchema: z.ZodType<Prisma.EnumActivityTypeFieldUpdateOperationsInput> =
  z
    .object({
      set: z.lazy(() => ActivityTypeSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.EnumActivityTypeFieldUpdateOperationsInput>;

export default EnumActivityTypeFieldUpdateOperationsInputSchema;
