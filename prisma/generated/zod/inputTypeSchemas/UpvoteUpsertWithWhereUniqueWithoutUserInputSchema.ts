import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { UpvoteWhereUniqueInputSchema } from './UpvoteWhereUniqueInputSchema';
import { UpvoteUpdateWithoutUserInputSchema } from './UpvoteUpdateWithoutUserInputSchema';
import { UpvoteUncheckedUpdateWithoutUserInputSchema } from './UpvoteUncheckedUpdateWithoutUserInputSchema';
import { UpvoteCreateWithoutUserInputSchema } from './UpvoteCreateWithoutUserInputSchema';
import { UpvoteUncheckedCreateWithoutUserInputSchema } from './UpvoteUncheckedCreateWithoutUserInputSchema';

export const UpvoteUpsertWithWhereUniqueWithoutUserInputSchema: z.ZodType<Prisma.UpvoteUpsertWithWhereUniqueWithoutUserInput> = z.object({
  where: z.lazy(() => UpvoteWhereUniqueInputSchema),
  update: z.union([ z.lazy(() => UpvoteUpdateWithoutUserInputSchema),z.lazy(() => UpvoteUncheckedUpdateWithoutUserInputSchema) ]),
  create: z.union([ z.lazy(() => UpvoteCreateWithoutUserInputSchema),z.lazy(() => UpvoteUncheckedCreateWithoutUserInputSchema) ]),
}).strict();

export default UpvoteUpsertWithWhereUniqueWithoutUserInputSchema;
