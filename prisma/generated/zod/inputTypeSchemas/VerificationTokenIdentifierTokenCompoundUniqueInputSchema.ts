import type { Prisma } from "@prisma/client";

import { z } from "zod";

export const VerificationTokenIdentifierTokenCompoundUniqueInputSchema: z.ZodType<Prisma.VerificationTokenIdentifierTokenCompoundUniqueInput> =
  z
    .object({
      identifier: z.string(),
      token: z.string(),
    })
    .strict() as z.ZodType<Prisma.VerificationTokenIdentifierTokenCompoundUniqueInput>;

export default VerificationTokenIdentifierTokenCompoundUniqueInputSchema;
