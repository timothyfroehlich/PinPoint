import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { PinballMapConfigUpdateManyMutationInputSchema } from "../inputTypeSchemas/PinballMapConfigUpdateManyMutationInputSchema";
import { PinballMapConfigUncheckedUpdateManyInputSchema } from "../inputTypeSchemas/PinballMapConfigUncheckedUpdateManyInputSchema";
import { PinballMapConfigWhereInputSchema } from "../inputTypeSchemas/PinballMapConfigWhereInputSchema";

export const PinballMapConfigUpdateManyAndReturnArgsSchema: z.ZodType<Prisma.PinballMapConfigUpdateManyAndReturnArgs> =
  z
    .object({
      data: z.union([
        PinballMapConfigUpdateManyMutationInputSchema,
        PinballMapConfigUncheckedUpdateManyInputSchema,
      ]),
      where: PinballMapConfigWhereInputSchema.optional(),
      limit: z.number().optional(),
    })
    .strict() as z.ZodType<Prisma.PinballMapConfigUpdateManyAndReturnArgs>;

export default PinballMapConfigUpdateManyAndReturnArgsSchema;
