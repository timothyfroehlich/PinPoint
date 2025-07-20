import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { MembershipUpdateManyMutationInputSchema } from "../inputTypeSchemas/MembershipUpdateManyMutationInputSchema";
import { MembershipUncheckedUpdateManyInputSchema } from "../inputTypeSchemas/MembershipUncheckedUpdateManyInputSchema";
import { MembershipWhereInputSchema } from "../inputTypeSchemas/MembershipWhereInputSchema";

export const MembershipUpdateManyArgsSchema: z.ZodType<Prisma.MembershipUpdateManyArgs> =
  z
    .object({
      data: z.union([
        MembershipUpdateManyMutationInputSchema,
        MembershipUncheckedUpdateManyInputSchema,
      ]),
      where: MembershipWhereInputSchema.optional(),
      limit: z.number().optional(),
    })
    .strict() as z.ZodType<Prisma.MembershipUpdateManyArgs>;

export default MembershipUpdateManyArgsSchema;
