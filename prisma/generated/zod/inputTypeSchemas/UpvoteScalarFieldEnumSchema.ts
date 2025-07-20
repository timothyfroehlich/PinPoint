import { z } from "zod";

export const UpvoteScalarFieldEnumSchema = z.enum([
  "id",
  "createdAt",
  "issueId",
  "userId",
]);

export default UpvoteScalarFieldEnumSchema;
