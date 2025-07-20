import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { NullableJsonNullValueInputSchema } from "./NullableJsonNullValueInputSchema";
import { InputJsonValueSchema } from "./InputJsonValueSchema";
import { MachineUncheckedCreateNestedManyWithoutCollectionsInputSchema } from "./MachineUncheckedCreateNestedManyWithoutCollectionsInputSchema";

export const CollectionUncheckedCreateWithoutTypeInputSchema: z.ZodType<Prisma.CollectionUncheckedCreateWithoutTypeInput> =
  z
    .object({
      id: z.string().cuid().optional(),
      name: z.string(),
      locationId: z.string().optional().nullable(),
      isSmart: z.boolean().optional(),
      isManual: z.boolean().optional(),
      description: z.string().optional().nullable(),
      sortOrder: z.number().int().optional(),
      filterCriteria: z
        .union([
          z.lazy(() => NullableJsonNullValueInputSchema),
          InputJsonValueSchema,
        ])
        .optional(),
      machines: z
        .lazy(
          () => MachineUncheckedCreateNestedManyWithoutCollectionsInputSchema,
        )
        .optional(),
    })
    .strict() as z.ZodType<Prisma.CollectionUncheckedCreateWithoutTypeInput>;

export default CollectionUncheckedCreateWithoutTypeInputSchema;
