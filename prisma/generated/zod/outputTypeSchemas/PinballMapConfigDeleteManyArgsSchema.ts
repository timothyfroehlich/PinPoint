import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { PinballMapConfigWhereInputSchema } from "../inputTypeSchemas/PinballMapConfigWhereInputSchema";

export const PinballMapConfigDeleteManyArgsSchema: z.ZodType<Prisma.PinballMapConfigDeleteManyArgs> =
  z
    .object({
      where: PinballMapConfigWhereInputSchema.optional(),
      limit: z.number().optional(),
    })
    .strict() as z.ZodType<Prisma.PinballMapConfigDeleteManyArgs>;

export default PinballMapConfigDeleteManyArgsSchema;
