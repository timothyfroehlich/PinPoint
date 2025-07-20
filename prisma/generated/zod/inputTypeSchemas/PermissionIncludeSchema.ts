import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { RoleFindManyArgsSchema } from "../outputTypeSchemas/RoleFindManyArgsSchema"
import { PermissionCountOutputTypeArgsSchema } from "../outputTypeSchemas/PermissionCountOutputTypeArgsSchema"

export const PermissionIncludeSchema: z.ZodType<Prisma.PermissionInclude> = z.object({
  roles: z.union([z.boolean(),z.lazy(() => RoleFindManyArgsSchema)]).optional(),
  _count: z.union([z.boolean(),z.lazy(() => PermissionCountOutputTypeArgsSchema)]).optional(),
}).strict()

export default PermissionIncludeSchema;
