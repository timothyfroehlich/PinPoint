import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { MembershipCreateManyRoleInputSchema } from "./MembershipCreateManyRoleInputSchema";

export const MembershipCreateManyRoleInputEnvelopeSchema: z.ZodType<Prisma.MembershipCreateManyRoleInputEnvelope> =
  z
    .object({
      data: z.union([
        z.lazy(() => MembershipCreateManyRoleInputSchema),
        z.lazy(() => MembershipCreateManyRoleInputSchema).array(),
      ]),
      skipDuplicates: z.boolean().optional(),
    })
    .strict() as z.ZodType<Prisma.MembershipCreateManyRoleInputEnvelope>;

export default MembershipCreateManyRoleInputEnvelopeSchema;
