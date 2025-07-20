import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { MachineCreateWithoutModelInputSchema } from "./MachineCreateWithoutModelInputSchema";
import { MachineUncheckedCreateWithoutModelInputSchema } from "./MachineUncheckedCreateWithoutModelInputSchema";
import { MachineCreateOrConnectWithoutModelInputSchema } from "./MachineCreateOrConnectWithoutModelInputSchema";
import { MachineUpsertWithWhereUniqueWithoutModelInputSchema } from "./MachineUpsertWithWhereUniqueWithoutModelInputSchema";
import { MachineCreateManyModelInputEnvelopeSchema } from "./MachineCreateManyModelInputEnvelopeSchema";
import { MachineWhereUniqueInputSchema } from "./MachineWhereUniqueInputSchema";
import { MachineUpdateWithWhereUniqueWithoutModelInputSchema } from "./MachineUpdateWithWhereUniqueWithoutModelInputSchema";
import { MachineUpdateManyWithWhereWithoutModelInputSchema } from "./MachineUpdateManyWithWhereWithoutModelInputSchema";
import { MachineScalarWhereInputSchema } from "./MachineScalarWhereInputSchema";

export const MachineUpdateManyWithoutModelNestedInputSchema: z.ZodType<Prisma.MachineUpdateManyWithoutModelNestedInput> =
  z
    .object({
      create: z
        .union([
          z.lazy(() => MachineCreateWithoutModelInputSchema),
          z.lazy(() => MachineCreateWithoutModelInputSchema).array(),
          z.lazy(() => MachineUncheckedCreateWithoutModelInputSchema),
          z.lazy(() => MachineUncheckedCreateWithoutModelInputSchema).array(),
        ])
        .optional(),
      connectOrCreate: z
        .union([
          z.lazy(() => MachineCreateOrConnectWithoutModelInputSchema),
          z.lazy(() => MachineCreateOrConnectWithoutModelInputSchema).array(),
        ])
        .optional(),
      upsert: z
        .union([
          z.lazy(() => MachineUpsertWithWhereUniqueWithoutModelInputSchema),
          z
            .lazy(() => MachineUpsertWithWhereUniqueWithoutModelInputSchema)
            .array(),
        ])
        .optional(),
      createMany: z
        .lazy(() => MachineCreateManyModelInputEnvelopeSchema)
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
          z.lazy(() => MachineUpdateWithWhereUniqueWithoutModelInputSchema),
          z
            .lazy(() => MachineUpdateWithWhereUniqueWithoutModelInputSchema)
            .array(),
        ])
        .optional(),
      updateMany: z
        .union([
          z.lazy(() => MachineUpdateManyWithWhereWithoutModelInputSchema),
          z
            .lazy(() => MachineUpdateManyWithWhereWithoutModelInputSchema)
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
    .strict() as z.ZodType<Prisma.MachineUpdateManyWithoutModelNestedInput>;

export default MachineUpdateManyWithoutModelNestedInputSchema;
