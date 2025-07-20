import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { MachineCreateManyOrganizationInputSchema } from "./MachineCreateManyOrganizationInputSchema";

export const MachineCreateManyOrganizationInputEnvelopeSchema: z.ZodType<Prisma.MachineCreateManyOrganizationInputEnvelope> =
  z
    .object({
      data: z.union([
        z.lazy(() => MachineCreateManyOrganizationInputSchema),
        z.lazy(() => MachineCreateManyOrganizationInputSchema).array(),
      ]),
      skipDuplicates: z.boolean().optional(),
    })
    .strict() as z.ZodType<Prisma.MachineCreateManyOrganizationInputEnvelope>;

export default MachineCreateManyOrganizationInputEnvelopeSchema;
