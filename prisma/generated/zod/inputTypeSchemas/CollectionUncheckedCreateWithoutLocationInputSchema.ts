import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { NullableJsonNullValueInputSchema } from "./NullableJsonNullValueInputSchema";
import { InputJsonValueSchema } from "./InputJsonValueSchema";
import { MachineUncheckedCreateNestedManyWithoutCollectionsInputSchema } from "./MachineUncheckedCreateNestedManyWithoutCollectionsInputSchema";

export const CollectionUncheckedCreateWithoutLocationInputSchema: z.ZodType<Prisma.CollectionUncheckedCreateWithoutLocationInput> =
  z
    .object({
      id: z.string().cuid().optional(),
      name: z.string(),
      typeId: z.string(),
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
    .strict() as z.ZodType<Prisma.CollectionUncheckedCreateWithoutLocationInput>;

export default CollectionUncheckedCreateWithoutLocationInputSchema;
