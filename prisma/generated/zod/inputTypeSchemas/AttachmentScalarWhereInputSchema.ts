import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { StringFilterSchema } from './StringFilterSchema';
import { DateTimeFilterSchema } from './DateTimeFilterSchema';

export const AttachmentScalarWhereInputSchema: z.ZodType<Prisma.AttachmentScalarWhereInput> = z.object({
  AND: z.union([ z.lazy(() => AttachmentScalarWhereInputSchema),z.lazy(() => AttachmentScalarWhereInputSchema).array() ]).optional(),
  OR: z.lazy(() => AttachmentScalarWhereInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => AttachmentScalarWhereInputSchema),z.lazy(() => AttachmentScalarWhereInputSchema).array() ]).optional(),
  id: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  url: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  fileName: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  fileType: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  createdAt: z.union([ z.lazy(() => DateTimeFilterSchema),z.coerce.date() ]).optional(),
  organizationId: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  issueId: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
}).strict();

export default AttachmentScalarWhereInputSchema;
