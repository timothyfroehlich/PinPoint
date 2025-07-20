import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { MachineCreateWithoutOwnerInputSchema } from "./MachineCreateWithoutOwnerInputSchema";
import { MachineUncheckedCreateWithoutOwnerInputSchema } from "./MachineUncheckedCreateWithoutOwnerInputSchema";
import { MachineCreateOrConnectWithoutOwnerInputSchema } from "./MachineCreateOrConnectWithoutOwnerInputSchema";
import { MachineCreateManyOwnerInputEnvelopeSchema } from "./MachineCreateManyOwnerInputEnvelopeSchema";
import { MachineWhereUniqueInputSchema } from "./MachineWhereUniqueInputSchema";

export const MachineCreateNestedManyWithoutOwnerInputSchema: z.ZodType<Prisma.MachineCreateNestedManyWithoutOwnerInput> =
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
      createMany: z
        .lazy(() => MachineCreateManyOwnerInputEnvelopeSchema)
        .optional(),
      connect: z
        .union([
          z.lazy(() => MachineWhereUniqueInputSchema),
          z.lazy(() => MachineWhereUniqueInputSchema).array(),
        ])
        .optional(),
    })
    .strict() as z.ZodType<Prisma.MachineCreateNestedManyWithoutOwnerInput>;

export default MachineCreateNestedManyWithoutOwnerInputSchema;
