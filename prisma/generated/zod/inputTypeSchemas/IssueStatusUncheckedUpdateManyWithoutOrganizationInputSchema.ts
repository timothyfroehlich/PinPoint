import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { StringFieldUpdateOperationsInputSchema } from "./StringFieldUpdateOperationsInputSchema";
import { StatusCategorySchema } from "./StatusCategorySchema";
import { EnumStatusCategoryFieldUpdateOperationsInputSchema } from "./EnumStatusCategoryFieldUpdateOperationsInputSchema";
import { BoolFieldUpdateOperationsInputSchema } from "./BoolFieldUpdateOperationsInputSchema";

export const IssueStatusUncheckedUpdateManyWithoutOrganizationInputSchema: z.ZodType<Prisma.IssueStatusUncheckedUpdateManyWithoutOrganizationInput> =
  z
    .object({
      id: z
        .union([
          z.string().cuid(),
          z.lazy(() => StringFieldUpdateOperationsInputSchema),
        ])
        .optional(),
      name: z
        .union([
          z.string(),
          z.lazy(() => StringFieldUpdateOperationsInputSchema),
        ])
        .optional(),
      category: z
        .union([
          z.lazy(() => StatusCategorySchema),
          z.lazy(() => EnumStatusCategoryFieldUpdateOperationsInputSchema),
        ])
        .optional(),
      isDefault: z
        .union([
          z.boolean(),
          z.lazy(() => BoolFieldUpdateOperationsInputSchema),
        ])
        .optional(),
    })
    .strict() as z.ZodType<Prisma.IssueStatusUncheckedUpdateManyWithoutOrganizationInput>;

export default IssueStatusUncheckedUpdateManyWithoutOrganizationInputSchema;
