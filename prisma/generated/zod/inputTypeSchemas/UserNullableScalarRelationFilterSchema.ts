import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { UserWhereInputSchema } from './UserWhereInputSchema';

export const UserNullableScalarRelationFilterSchema: z.ZodType<Prisma.UserNullableScalarRelationFilter> = z.object({
  is: z.lazy(() => UserWhereInputSchema).optional().nullable(),
  isNot: z.lazy(() => UserWhereInputSchema).optional().nullable()
}).strict();

export default UserNullableScalarRelationFilterSchema;
