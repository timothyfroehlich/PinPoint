import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { PriorityCreateManyOrganizationInputSchema } from "./PriorityCreateManyOrganizationInputSchema";

export const PriorityCreateManyOrganizationInputEnvelopeSchema: z.ZodType<Prisma.PriorityCreateManyOrganizationInputEnvelope> =
  z
    .object({
      data: z.union([
        z.lazy(() => PriorityCreateManyOrganizationInputSchema),
        z.lazy(() => PriorityCreateManyOrganizationInputSchema).array(),
      ]),
      skipDuplicates: z.boolean().optional(),
    })
    .strict() as z.ZodType<Prisma.PriorityCreateManyOrganizationInputEnvelope>;

export default PriorityCreateManyOrganizationInputEnvelopeSchema;
