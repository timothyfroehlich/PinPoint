import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { StringFilterSchema } from "./StringFilterSchema";
import { RoleListRelationFilterSchema } from "./RoleListRelationFilterSchema";

export const PermissionWhereInputSchema: z.ZodType<Prisma.PermissionWhereInput> =
  z
    .object({
      AND: z
        .union([
          z.lazy(() => PermissionWhereInputSchema),
          z.lazy(() => PermissionWhereInputSchema).array(),
        ])
        .optional(),
      OR: z
        .lazy(() => PermissionWhereInputSchema)
        .array()
        .optional(),
      NOT: z
        .union([
          z.lazy(() => PermissionWhereInputSchema),
          z.lazy(() => PermissionWhereInputSchema).array(),
        ])
        .optional(),
      id: z.union([z.lazy(() => StringFilterSchema), z.string()]).optional(),
      name: z.union([z.lazy(() => StringFilterSchema), z.string()]).optional(),
      roles: z.lazy(() => RoleListRelationFilterSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.PermissionWhereInput>;

export default PermissionWhereInputSchema;
