import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { PermissionSelectSchema } from '../inputTypeSchemas/PermissionSelectSchema';
import { PermissionIncludeSchema } from '../inputTypeSchemas/PermissionIncludeSchema';

export const PermissionArgsSchema: z.ZodType<Prisma.PermissionDefaultArgs> = z.object({
  select: z.lazy(() => PermissionSelectSchema).optional(),
  include: z.lazy(() => PermissionIncludeSchema).optional(),
}).strict();

export default PermissionArgsSchema;
