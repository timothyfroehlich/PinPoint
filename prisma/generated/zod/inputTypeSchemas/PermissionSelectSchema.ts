import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { RoleFindManyArgsSchema } from "../outputTypeSchemas/RoleFindManyArgsSchema";
import { PermissionCountOutputTypeArgsSchema } from "../outputTypeSchemas/PermissionCountOutputTypeArgsSchema";

export const PermissionSelectSchema: z.ZodType<Prisma.PermissionSelect> = z
  .object({
    id: z.boolean().optional(),
    name: z.boolean().optional(),
    roles: z
      .union([z.boolean(), z.lazy(() => RoleFindManyArgsSchema)])
      .optional(),
    _count: z
      .union([z.boolean(), z.lazy(() => PermissionCountOutputTypeArgsSchema)])
      .optional(),
  })
  .strict();

export default PermissionSelectSchema;
