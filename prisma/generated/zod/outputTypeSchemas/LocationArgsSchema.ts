import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { LocationSelectSchema } from "../inputTypeSchemas/LocationSelectSchema";
import { LocationIncludeSchema } from "../inputTypeSchemas/LocationIncludeSchema";

export const LocationArgsSchema: z.ZodType<Prisma.LocationDefaultArgs> = z
  .object({
    select: z.lazy(() => LocationSelectSchema).optional(),
    include: z.lazy(() => LocationIncludeSchema).optional(),
  })
  .strict();

export default LocationArgsSchema;
