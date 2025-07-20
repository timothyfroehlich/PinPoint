import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { ModelCountOutputTypeSelectSchema } from "./ModelCountOutputTypeSelectSchema";

export const ModelCountOutputTypeArgsSchema: z.ZodType<Prisma.ModelCountOutputTypeDefaultArgs> =
  z
    .object({
      select: z.lazy(() => ModelCountOutputTypeSelectSchema).nullish(),
    })
    .strict();

export default ModelCountOutputTypeSelectSchema;
