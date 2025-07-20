import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { UpvoteScalarWhereInputSchema } from './UpvoteScalarWhereInputSchema';
import { UpvoteUpdateManyMutationInputSchema } from './UpvoteUpdateManyMutationInputSchema';
import { UpvoteUncheckedUpdateManyWithoutIssueInputSchema } from './UpvoteUncheckedUpdateManyWithoutIssueInputSchema';

export const UpvoteUpdateManyWithWhereWithoutIssueInputSchema: z.ZodType<Prisma.UpvoteUpdateManyWithWhereWithoutIssueInput> = z.object({
  where: z.lazy(() => UpvoteScalarWhereInputSchema),
  data: z.union([ z.lazy(() => UpvoteUpdateManyMutationInputSchema),z.lazy(() => UpvoteUncheckedUpdateManyWithoutIssueInputSchema) ]),
}).strict();

export default UpvoteUpdateManyWithWhereWithoutIssueInputSchema;
