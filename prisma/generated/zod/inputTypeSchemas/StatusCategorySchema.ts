import { z } from 'zod';

export const StatusCategorySchema = z.enum(['NEW','IN_PROGRESS','RESOLVED']);

export type StatusCategoryType = `${z.infer<typeof StatusCategorySchema>}`

export default StatusCategorySchema;
