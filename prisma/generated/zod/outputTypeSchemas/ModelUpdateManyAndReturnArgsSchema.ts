import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { ModelUpdateManyMutationInputSchema } from "../inputTypeSchemas/ModelUpdateManyMutationInputSchema";
import { ModelUncheckedUpdateManyInputSchema } from "../inputTypeSchemas/ModelUncheckedUpdateManyInputSchema";
import { ModelWhereInputSchema } from "../inputTypeSchemas/ModelWhereInputSchema";

export const ModelUpdateManyAndReturnArgsSchema: z.ZodType<Prisma.ModelUpdateManyAndReturnArgs> =
  z
    .object({
      data: z.union([
        ModelUpdateManyMutationInputSchema,
        ModelUncheckedUpdateManyInputSchema,
      ]),
      where: ModelWhereInputSchema.optional(),
      limit: z.number().optional(),
    })
    .strict() as z.ZodType<Prisma.ModelUpdateManyAndReturnArgs>;

export default ModelUpdateManyAndReturnArgsSchema;
