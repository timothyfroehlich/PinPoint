import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { MembershipCreateManyInputSchema } from "../inputTypeSchemas/MembershipCreateManyInputSchema";

export const MembershipCreateManyAndReturnArgsSchema: z.ZodType<Prisma.MembershipCreateManyAndReturnArgs> =
  z
    .object({
      data: z.union([
        MembershipCreateManyInputSchema,
        MembershipCreateManyInputSchema.array(),
      ]),
      skipDuplicates: z.boolean().optional(),
    })
    .strict() as z.ZodType<Prisma.MembershipCreateManyAndReturnArgs>;

export default MembershipCreateManyAndReturnArgsSchema;
