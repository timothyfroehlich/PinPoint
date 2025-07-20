import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { StatusCategorySchema } from "./StatusCategorySchema";

export const EnumStatusCategoryFieldUpdateOperationsInputSchema: z.ZodType<Prisma.EnumStatusCategoryFieldUpdateOperationsInput> =
  z
    .object({
      set: z.lazy(() => StatusCategorySchema).optional(),
    })
    .strict() as z.ZodType<Prisma.EnumStatusCategoryFieldUpdateOperationsInput>;

export default EnumStatusCategoryFieldUpdateOperationsInputSchema;
