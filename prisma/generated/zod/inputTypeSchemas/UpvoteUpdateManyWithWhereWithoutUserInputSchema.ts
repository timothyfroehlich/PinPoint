import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { UpvoteScalarWhereInputSchema } from './UpvoteScalarWhereInputSchema';
import { UpvoteUpdateManyMutationInputSchema } from './UpvoteUpdateManyMutationInputSchema';
import { UpvoteUncheckedUpdateManyWithoutUserInputSchema } from './UpvoteUncheckedUpdateManyWithoutUserInputSchema';

export const UpvoteUpdateManyWithWhereWithoutUserInputSchema: z.ZodType<Prisma.UpvoteUpdateManyWithWhereWithoutUserInput> = z.object({
  where: z.lazy(() => UpvoteScalarWhereInputSchema),
  data: z.union([ z.lazy(() => UpvoteUpdateManyMutationInputSchema),z.lazy(() => UpvoteUncheckedUpdateManyWithoutUserInputSchema) ]),
}).strict();

export default UpvoteUpdateManyWithWhereWithoutUserInputSchema;
