import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { MembershipSelectSchema } from "../inputTypeSchemas/MembershipSelectSchema";
import { MembershipIncludeSchema } from "../inputTypeSchemas/MembershipIncludeSchema";

export const MembershipArgsSchema: z.ZodType<Prisma.MembershipDefaultArgs> = z
  .object({
    select: z.lazy(() => MembershipSelectSchema).optional(),
    include: z.lazy(() => MembershipIncludeSchema).optional(),
  })
  .strict();

export default MembershipArgsSchema;
