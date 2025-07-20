import { z } from 'zod';

export const CommentScalarFieldEnumSchema = z.enum(['id','content','createdAt','updatedAt','deletedAt','deletedBy','issueId','authorId']);

export default CommentScalarFieldEnumSchema;
