import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { UserCreateWithoutUpvotesInputSchema } from './UserCreateWithoutUpvotesInputSchema';
import { UserUncheckedCreateWithoutUpvotesInputSchema } from './UserUncheckedCreateWithoutUpvotesInputSchema';
import { UserCreateOrConnectWithoutUpvotesInputSchema } from './UserCreateOrConnectWithoutUpvotesInputSchema';
import { UserWhereUniqueInputSchema } from './UserWhereUniqueInputSchema';

export const UserCreateNestedOneWithoutUpvotesInputSchema: z.ZodType<Prisma.UserCreateNestedOneWithoutUpvotesInput> = z.object({
  create: z.union([ z.lazy(() => UserCreateWithoutUpvotesInputSchema),z.lazy(() => UserUncheckedCreateWithoutUpvotesInputSchema) ]).optional(),
  connectOrCreate: z.lazy(() => UserCreateOrConnectWithoutUpvotesInputSchema).optional(),
  connect: z.lazy(() => UserWhereUniqueInputSchema).optional()
}).strict();

export default UserCreateNestedOneWithoutUpvotesInputSchema;
