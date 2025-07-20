import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { MachineCreateManyLocationInputSchema } from "./MachineCreateManyLocationInputSchema";

export const MachineCreateManyLocationInputEnvelopeSchema: z.ZodType<Prisma.MachineCreateManyLocationInputEnvelope> =
  z
    .object({
      data: z.union([
        z.lazy(() => MachineCreateManyLocationInputSchema),
        z.lazy(() => MachineCreateManyLocationInputSchema).array(),
      ]),
      skipDuplicates: z.boolean().optional(),
    })
    .strict() as z.ZodType<Prisma.MachineCreateManyLocationInputEnvelope>;

export default MachineCreateManyLocationInputEnvelopeSchema;
