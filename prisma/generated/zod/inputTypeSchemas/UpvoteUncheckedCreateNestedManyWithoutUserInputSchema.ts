import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { UpvoteCreateWithoutUserInputSchema } from './UpvoteCreateWithoutUserInputSchema';
import { UpvoteUncheckedCreateWithoutUserInputSchema } from './UpvoteUncheckedCreateWithoutUserInputSchema';
import { UpvoteCreateOrConnectWithoutUserInputSchema } from './UpvoteCreateOrConnectWithoutUserInputSchema';
import { UpvoteCreateManyUserInputEnvelopeSchema } from './UpvoteCreateManyUserInputEnvelopeSchema';
import { UpvoteWhereUniqueInputSchema } from './UpvoteWhereUniqueInputSchema';

export const UpvoteUncheckedCreateNestedManyWithoutUserInputSchema: z.ZodType<Prisma.UpvoteUncheckedCreateNestedManyWithoutUserInput> = z.object({
  create: z.union([ z.lazy(() => UpvoteCreateWithoutUserInputSchema),z.lazy(() => UpvoteCreateWithoutUserInputSchema).array(),z.lazy(() => UpvoteUncheckedCreateWithoutUserInputSchema),z.lazy(() => UpvoteUncheckedCreateWithoutUserInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => UpvoteCreateOrConnectWithoutUserInputSchema),z.lazy(() => UpvoteCreateOrConnectWithoutUserInputSchema).array() ]).optional(),
  createMany: z.lazy(() => UpvoteCreateManyUserInputEnvelopeSchema).optional(),
  connect: z.union([ z.lazy(() => UpvoteWhereUniqueInputSchema),z.lazy(() => UpvoteWhereUniqueInputSchema).array() ]).optional(),
}).strict();

export default UpvoteUncheckedCreateNestedManyWithoutUserInputSchema;
