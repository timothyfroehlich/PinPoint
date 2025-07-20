import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { MachineCreateWithoutCollectionsInputSchema } from "./MachineCreateWithoutCollectionsInputSchema";
import { MachineUncheckedCreateWithoutCollectionsInputSchema } from "./MachineUncheckedCreateWithoutCollectionsInputSchema";
import { MachineCreateOrConnectWithoutCollectionsInputSchema } from "./MachineCreateOrConnectWithoutCollectionsInputSchema";
import { MachineUpsertWithWhereUniqueWithoutCollectionsInputSchema } from "./MachineUpsertWithWhereUniqueWithoutCollectionsInputSchema";
import { MachineWhereUniqueInputSchema } from "./MachineWhereUniqueInputSchema";
import { MachineUpdateWithWhereUniqueWithoutCollectionsInputSchema } from "./MachineUpdateWithWhereUniqueWithoutCollectionsInputSchema";
import { MachineUpdateManyWithWhereWithoutCollectionsInputSchema } from "./MachineUpdateManyWithWhereWithoutCollectionsInputSchema";
import { MachineScalarWhereInputSchema } from "./MachineScalarWhereInputSchema";

export const MachineUncheckedUpdateManyWithoutCollectionsNestedInputSchema: z.ZodType<Prisma.MachineUncheckedUpdateManyWithoutCollectionsNestedInput> =
  z
    .object({
      create: z
        .union([
          z.lazy(() => MachineCreateWithoutCollectionsInputSchema),
          z.lazy(() => MachineCreateWithoutCollectionsInputSchema).array(),
          z.lazy(() => MachineUncheckedCreateWithoutCollectionsInputSchema),
          z
            .lazy(() => MachineUncheckedCreateWithoutCollectionsInputSchema)
            .array(),
        ])
        .optional(),
      connectOrCreate: z
        .union([
          z.lazy(() => MachineCreateOrConnectWithoutCollectionsInputSchema),
          z
            .lazy(() => MachineCreateOrConnectWithoutCollectionsInputSchema)
            .array(),
        ])
        .optional(),
      upsert: z
        .union([
          z.lazy(
            () => MachineUpsertWithWhereUniqueWithoutCollectionsInputSchema,
          ),
          z
            .lazy(
              () => MachineUpsertWithWhereUniqueWithoutCollectionsInputSchema,
            )
            .array(),
        ])
        .optional(),
      set: z
        .union([
          z.lazy(() => MachineWhereUniqueInputSchema),
          z.lazy(() => MachineWhereUniqueInputSchema).array(),
        ])
        .optional(),
      disconnect: z
        .union([
          z.lazy(() => MachineWhereUniqueInputSchema),
          z.lazy(() => MachineWhereUniqueInputSchema).array(),
        ])
        .optional(),
      delete: z
        .union([
          z.lazy(() => MachineWhereUniqueInputSchema),
          z.lazy(() => MachineWhereUniqueInputSchema).array(),
        ])
        .optional(),
      connect: z
        .union([
          z.lazy(() => MachineWhereUniqueInputSchema),
          z.lazy(() => MachineWhereUniqueInputSchema).array(),
        ])
        .optional(),
      update: z
        .union([
          z.lazy(
            () => MachineUpdateWithWhereUniqueWithoutCollectionsInputSchema,
          ),
          z
            .lazy(
              () => MachineUpdateWithWhereUniqueWithoutCollectionsInputSchema,
            )
            .array(),
        ])
        .optional(),
      updateMany: z
        .union([
          z.lazy(() => MachineUpdateManyWithWhereWithoutCollectionsInputSchema),
          z
            .lazy(() => MachineUpdateManyWithWhereWithoutCollectionsInputSchema)
            .array(),
        ])
        .optional(),
      deleteMany: z
        .union([
          z.lazy(() => MachineScalarWhereInputSchema),
          z.lazy(() => MachineScalarWhereInputSchema).array(),
        ])
        .optional(),
    })
    .strict() as z.ZodType<Prisma.MachineUncheckedUpdateManyWithoutCollectionsNestedInput>;

export default MachineUncheckedUpdateManyWithoutCollectionsNestedInputSchema;
