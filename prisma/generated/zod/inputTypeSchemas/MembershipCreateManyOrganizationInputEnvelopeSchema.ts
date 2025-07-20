import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { MembershipCreateManyOrganizationInputSchema } from "./MembershipCreateManyOrganizationInputSchema";

export const MembershipCreateManyOrganizationInputEnvelopeSchema: z.ZodType<Prisma.MembershipCreateManyOrganizationInputEnvelope> =
  z
    .object({
      data: z.union([
        z.lazy(() => MembershipCreateManyOrganizationInputSchema),
        z.lazy(() => MembershipCreateManyOrganizationInputSchema).array(),
      ]),
      skipDuplicates: z.boolean().optional(),
    })
    .strict() as z.ZodType<Prisma.MembershipCreateManyOrganizationInputEnvelope>;

export default MembershipCreateManyOrganizationInputEnvelopeSchema;
