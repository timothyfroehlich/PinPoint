import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { ModelSelectSchema } from "../inputTypeSchemas/ModelSelectSchema";
import { ModelIncludeSchema } from "../inputTypeSchemas/ModelIncludeSchema";

export const ModelArgsSchema: z.ZodType<Prisma.ModelDefaultArgs> = z
  .object({
    select: z.lazy(() => ModelSelectSchema).optional(),
    include: z.lazy(() => ModelIncludeSchema).optional(),
  })
  .strict();

export default ModelArgsSchema;
