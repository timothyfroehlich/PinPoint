import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { PermissionWhereInputSchema } from "./PermissionWhereInputSchema";
import { RoleListRelationFilterSchema } from "./RoleListRelationFilterSchema";

export const PermissionWhereUniqueInputSchema: z.ZodType<Prisma.PermissionWhereUniqueInput> =
  z
    .union([
      z.object({
        id: z.string().cuid(),
        name: z.string(),
      }),
      z.object({
        id: z.string().cuid(),
      }),
      z.object({
        name: z.string(),
      }),
    ])
    .and(
      z
        .object({
          id: z.string().cuid().optional(),
          name: z.string().optional(),
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
          roles: z.lazy(() => RoleListRelationFilterSchema).optional(),
        })
        .strict(),
    ) as z.ZodType<Prisma.PermissionWhereUniqueInput>;

export default PermissionWhereUniqueInputSchema;
