import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { StringFieldUpdateOperationsInputSchema } from "./StringFieldUpdateOperationsInputSchema";
import { BoolFieldUpdateOperationsInputSchema } from "./BoolFieldUpdateOperationsInputSchema";
import { NullableStringFieldUpdateOperationsInputSchema } from "./NullableStringFieldUpdateOperationsInputSchema";
import { IntFieldUpdateOperationsInputSchema } from "./IntFieldUpdateOperationsInputSchema";
import { NullableJsonNullValueInputSchema } from "./NullableJsonNullValueInputSchema";
import { InputJsonValueSchema } from "./InputJsonValueSchema";
import { LocationUpdateOneWithoutCollectionsNestedInputSchema } from "./LocationUpdateOneWithoutCollectionsNestedInputSchema";
import { MachineUpdateManyWithoutCollectionsNestedInputSchema } from "./MachineUpdateManyWithoutCollectionsNestedInputSchema";

export const CollectionUpdateWithoutTypeInputSchema: z.ZodType<Prisma.CollectionUpdateWithoutTypeInput> =
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
      isSmart: z
        .union([
          z.boolean(),
          z.lazy(() => BoolFieldUpdateOperationsInputSchema),
        ])
        .optional(),
      isManual: z
        .union([
          z.boolean(),
          z.lazy(() => BoolFieldUpdateOperationsInputSchema),
        ])
        .optional(),
      description: z
        .union([
          z.string(),
          z.lazy(() => NullableStringFieldUpdateOperationsInputSchema),
        ])
        .optional()
        .nullable(),
      sortOrder: z
        .union([
          z.number().int(),
          z.lazy(() => IntFieldUpdateOperationsInputSchema),
        ])
        .optional(),
      filterCriteria: z
        .union([
          z.lazy(() => NullableJsonNullValueInputSchema),
          InputJsonValueSchema,
        ])
        .optional(),
      location: z
        .lazy(() => LocationUpdateOneWithoutCollectionsNestedInputSchema)
        .optional(),
      machines: z
        .lazy(() => MachineUpdateManyWithoutCollectionsNestedInputSchema)
        .optional(),
    })
    .strict() as z.ZodType<Prisma.CollectionUpdateWithoutTypeInput>;

export default CollectionUpdateWithoutTypeInputSchema;
