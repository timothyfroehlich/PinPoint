import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { UpvoteIncludeSchema } from '../inputTypeSchemas/UpvoteIncludeSchema'
import { UpvoteWhereInputSchema } from '../inputTypeSchemas/UpvoteWhereInputSchema'
import { UpvoteOrderByWithRelationInputSchema } from '../inputTypeSchemas/UpvoteOrderByWithRelationInputSchema'
import { UpvoteWhereUniqueInputSchema } from '../inputTypeSchemas/UpvoteWhereUniqueInputSchema'
import { UpvoteScalarFieldEnumSchema } from '../inputTypeSchemas/UpvoteScalarFieldEnumSchema'
import { IssueArgsSchema } from "../outputTypeSchemas/IssueArgsSchema"
import { UserArgsSchema } from "../outputTypeSchemas/UserArgsSchema"
// Select schema needs to be in file to prevent circular imports
//------------------------------------------------------

export const UpvoteSelectSchema: z.ZodType<Prisma.UpvoteSelect> = z.object({
  id: z.boolean().optional(),
  createdAt: z.boolean().optional(),
  issueId: z.boolean().optional(),
  userId: z.boolean().optional(),
  issue: z.union([z.boolean(),z.lazy(() => IssueArgsSchema)]).optional(),
  user: z.union([z.boolean(),z.lazy(() => UserArgsSchema)]).optional(),
}).strict()

export const UpvoteFindManyArgsSchema: z.ZodType<Prisma.UpvoteFindManyArgs> = z.object({
  select: UpvoteSelectSchema.optional(),
  include: z.lazy(() => UpvoteIncludeSchema).optional(),
  where: UpvoteWhereInputSchema.optional(),
  orderBy: z.union([ UpvoteOrderByWithRelationInputSchema.array(),UpvoteOrderByWithRelationInputSchema ]).optional(),
  cursor: UpvoteWhereUniqueInputSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  distinct: z.union([ UpvoteScalarFieldEnumSchema,UpvoteScalarFieldEnumSchema.array() ]).optional(),
}).strict() ;

export default UpvoteFindManyArgsSchema;
