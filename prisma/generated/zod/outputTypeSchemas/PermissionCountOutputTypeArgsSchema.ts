import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { PermissionCountOutputTypeSelectSchema } from "./PermissionCountOutputTypeSelectSchema";

export const PermissionCountOutputTypeArgsSchema: z.ZodType<Prisma.PermissionCountOutputTypeDefaultArgs> =
  z
    .object({
      select: z.lazy(() => PermissionCountOutputTypeSelectSchema).nullish(),
    })
    .strict();

export default PermissionCountOutputTypeSelectSchema;
