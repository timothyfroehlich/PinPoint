import type { Prisma } from "@prisma/client";

import { z } from "zod";

export const AccountProviderProviderAccountIdCompoundUniqueInputSchema: z.ZodType<Prisma.AccountProviderProviderAccountIdCompoundUniqueInput> =
  z
    .object({
      provider: z.string(),
      providerAccountId: z.string(),
    })
    .strict() as z.ZodType<Prisma.AccountProviderProviderAccountIdCompoundUniqueInput>;

export default AccountProviderProviderAccountIdCompoundUniqueInputSchema;
