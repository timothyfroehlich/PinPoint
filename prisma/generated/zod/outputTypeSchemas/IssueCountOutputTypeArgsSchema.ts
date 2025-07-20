import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { IssueCountOutputTypeSelectSchema } from "./IssueCountOutputTypeSelectSchema";

export const IssueCountOutputTypeArgsSchema: z.ZodType<Prisma.IssueCountOutputTypeDefaultArgs> =
  z
    .object({
      select: z.lazy(() => IssueCountOutputTypeSelectSchema).nullish(),
    })
    .strict();

export default IssueCountOutputTypeSelectSchema;
