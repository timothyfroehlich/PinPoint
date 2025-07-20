import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { UpvoteWhereUniqueInputSchema } from './UpvoteWhereUniqueInputSchema';
import { UpvoteUpdateWithoutUserInputSchema } from './UpvoteUpdateWithoutUserInputSchema';
import { UpvoteUncheckedUpdateWithoutUserInputSchema } from './UpvoteUncheckedUpdateWithoutUserInputSchema';

export const UpvoteUpdateWithWhereUniqueWithoutUserInputSchema: z.ZodType<Prisma.UpvoteUpdateWithWhereUniqueWithoutUserInput> = z.object({
  where: z.lazy(() => UpvoteWhereUniqueInputSchema),
  data: z.union([ z.lazy(() => UpvoteUpdateWithoutUserInputSchema),z.lazy(() => UpvoteUncheckedUpdateWithoutUserInputSchema) ]),
}).strict();

export default UpvoteUpdateWithWhereUniqueWithoutUserInputSchema;
