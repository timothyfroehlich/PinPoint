import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { RoleUpdateManyMutationInputSchema } from "../inputTypeSchemas/RoleUpdateManyMutationInputSchema";
import { RoleUncheckedUpdateManyInputSchema } from "../inputTypeSchemas/RoleUncheckedUpdateManyInputSchema";
import { RoleWhereInputSchema } from "../inputTypeSchemas/RoleWhereInputSchema";

export const RoleUpdateManyAndReturnArgsSchema: z.ZodType<Prisma.RoleUpdateManyAndReturnArgs> =
  z
    .object({
      data: z.union([
        RoleUpdateManyMutationInputSchema,
        RoleUncheckedUpdateManyInputSchema,
      ]),
      where: RoleWhereInputSchema.optional(),
      limit: z.number().optional(),
    })
    .strict() as z.ZodType<Prisma.RoleUpdateManyAndReturnArgs>;

export default RoleUpdateManyAndReturnArgsSchema;
