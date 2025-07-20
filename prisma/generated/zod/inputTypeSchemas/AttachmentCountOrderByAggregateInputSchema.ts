import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { SortOrderSchema } from './SortOrderSchema';

export const AttachmentCountOrderByAggregateInputSchema: z.ZodType<Prisma.AttachmentCountOrderByAggregateInput> = z.object({
  id: z.lazy(() => SortOrderSchema).optional(),
  url: z.lazy(() => SortOrderSchema).optional(),
  fileName: z.lazy(() => SortOrderSchema).optional(),
  fileType: z.lazy(() => SortOrderSchema).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
  organizationId: z.lazy(() => SortOrderSchema).optional(),
  issueId: z.lazy(() => SortOrderSchema).optional()
}).strict();

export default AttachmentCountOrderByAggregateInputSchema;
