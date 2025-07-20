import type { Prisma } from "@prisma/client";

import { z } from "zod";

export const SessionUncheckedCreateInputSchema: z.ZodType<Prisma.SessionUncheckedCreateInput> =
  z
    .object({
      id: z.string().cuid().optional(),
      sessionToken: z.string(),
      userId: z.string(),
      expires: z.coerce.date(),
    })
    .strict() as z.ZodType<Prisma.SessionUncheckedCreateInput>;

export default SessionUncheckedCreateInputSchema;
