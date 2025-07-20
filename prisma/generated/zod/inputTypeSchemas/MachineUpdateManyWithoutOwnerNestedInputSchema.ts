import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { MachineCreateWithoutOwnerInputSchema } from "./MachineCreateWithoutOwnerInputSchema";
import { MachineUncheckedCreateWithoutOwnerInputSchema } from "./MachineUncheckedCreateWithoutOwnerInputSchema";
import { MachineCreateOrConnectWithoutOwnerInputSchema } from "./MachineCreateOrConnectWithoutOwnerInputSchema";
import { MachineUpsertWithWhereUniqueWithoutOwnerInputSchema } from "./MachineUpsertWithWhereUniqueWithoutOwnerInputSchema";
import { MachineCreateManyOwnerInputEnvelopeSchema } from "./MachineCreateManyOwnerInputEnvelopeSchema";
import { MachineWhereUniqueInputSchema } from "./MachineWhereUniqueInputSchema";
import { MachineUpdateWithWhereUniqueWithoutOwnerInputSchema } from "./MachineUpdateWithWhereUniqueWithoutOwnerInputSchema";
import { MachineUpdateManyWithWhereWithoutOwnerInputSchema } from "./MachineUpdateManyWithWhereWithoutOwnerInputSchema";
import { MachineScalarWhereInputSchema } from "./MachineScalarWhereInputSchema";

export const MachineUpdateManyWithoutOwnerNestedInputSchema: z.ZodType<Prisma.MachineUpdateManyWithoutOwnerNestedInput> =
  z
    .object({
      create: z
        .union([
          z.lazy(() => MachineCreateWithoutOwnerInputSchema),
          z.lazy(() => MachineCreateWithoutOwnerInputSchema).array(),
          z.lazy(() => MachineUncheckedCreateWithoutOwnerInputSchema),
          z.lazy(() => MachineUncheckedCreateWithoutOwnerInputSchema).array(),
        ])
        .optional(),
      connectOrCreate: z
        .union([
          z.lazy(() => MachineCreateOrConnectWithoutOwnerInputSchema),
          z.lazy(() => MachineCreateOrConnectWithoutOwnerInputSchema).array(),
        ])
        .optional(),
      upsert: z
        .union([
          z.lazy(() => MachineUpsertWithWhereUniqueWithoutOwnerInputSchema),
          z
            .lazy(() => MachineUpsertWithWhereUniqueWithoutOwnerInputSchema)
            .array(),
        ])
        .optional(),
      createMany: z
        .lazy(() => MachineCreateManyOwnerInputEnvelopeSchema)
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
          z.lazy(() => MachineUpdateWithWhereUniqueWithoutOwnerInputSchema),
          z
            .lazy(() => MachineUpdateWithWhereUniqueWithoutOwnerInputSchema)
            .array(),
        ])
        .optional(),
      updateMany: z
        .union([
          z.lazy(() => MachineUpdateManyWithWhereWithoutOwnerInputSchema),
          z
            .lazy(() => MachineUpdateManyWithWhereWithoutOwnerInputSchema)
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
    .strict() as z.ZodType<Prisma.MachineUpdateManyWithoutOwnerNestedInput>;

export default MachineUpdateManyWithoutOwnerNestedInputSchema;
