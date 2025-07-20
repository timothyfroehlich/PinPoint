import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { MembershipCreateManyUserInputSchema } from "./MembershipCreateManyUserInputSchema";

export const MembershipCreateManyUserInputEnvelopeSchema: z.ZodType<Prisma.MembershipCreateManyUserInputEnvelope> =
  z
    .object({
      data: z.union([
        z.lazy(() => MembershipCreateManyUserInputSchema),
        z.lazy(() => MembershipCreateManyUserInputSchema).array(),
      ]),
      skipDuplicates: z.boolean().optional(),
    })
    .strict() as z.ZodType<Prisma.MembershipCreateManyUserInputEnvelope>;

export default MembershipCreateManyUserInputEnvelopeSchema;
