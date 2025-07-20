import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { MachineCreateManyModelInputSchema } from "./MachineCreateManyModelInputSchema";

export const MachineCreateManyModelInputEnvelopeSchema: z.ZodType<Prisma.MachineCreateManyModelInputEnvelope> =
  z
    .object({
      data: z.union([
        z.lazy(() => MachineCreateManyModelInputSchema),
        z.lazy(() => MachineCreateManyModelInputSchema).array(),
      ]),
      skipDuplicates: z.boolean().optional(),
    })
    .strict() as z.ZodType<Prisma.MachineCreateManyModelInputEnvelope>;

export default MachineCreateManyModelInputEnvelopeSchema;
