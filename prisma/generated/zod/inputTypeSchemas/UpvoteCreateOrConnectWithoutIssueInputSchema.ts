import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { UpvoteWhereUniqueInputSchema } from './UpvoteWhereUniqueInputSchema';
import { UpvoteCreateWithoutIssueInputSchema } from './UpvoteCreateWithoutIssueInputSchema';
import { UpvoteUncheckedCreateWithoutIssueInputSchema } from './UpvoteUncheckedCreateWithoutIssueInputSchema';

export const UpvoteCreateOrConnectWithoutIssueInputSchema: z.ZodType<Prisma.UpvoteCreateOrConnectWithoutIssueInput> = z.object({
  where: z.lazy(() => UpvoteWhereUniqueInputSchema),
  create: z.union([ z.lazy(() => UpvoteCreateWithoutIssueInputSchema),z.lazy(() => UpvoteUncheckedCreateWithoutIssueInputSchema) ]),
}).strict();

export default UpvoteCreateOrConnectWithoutIssueInputSchema;
