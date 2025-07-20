import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { MachineCreateManyOwnerInputSchema } from "./MachineCreateManyOwnerInputSchema";

export const MachineCreateManyOwnerInputEnvelopeSchema: z.ZodType<Prisma.MachineCreateManyOwnerInputEnvelope> =
  z
    .object({
      data: z.union([
        z.lazy(() => MachineCreateManyOwnerInputSchema),
        z.lazy(() => MachineCreateManyOwnerInputSchema).array(),
      ]),
      skipDuplicates: z.boolean().optional(),
    })
    .strict() as z.ZodType<Prisma.MachineCreateManyOwnerInputEnvelope>;

export default MachineCreateManyOwnerInputEnvelopeSchema;
