import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { IssueWhereUniqueInputSchema } from "./IssueWhereUniqueInputSchema";
import { IssueCreateWithoutCommentsInputSchema } from "./IssueCreateWithoutCommentsInputSchema";
import { IssueUncheckedCreateWithoutCommentsInputSchema } from "./IssueUncheckedCreateWithoutCommentsInputSchema";

export const IssueCreateOrConnectWithoutCommentsInputSchema: z.ZodType<Prisma.IssueCreateOrConnectWithoutCommentsInput> =
  z
    .object({
      where: z.lazy(() => IssueWhereUniqueInputSchema),
      create: z.union([
        z.lazy(() => IssueCreateWithoutCommentsInputSchema),
        z.lazy(() => IssueUncheckedCreateWithoutCommentsInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.IssueCreateOrConnectWithoutCommentsInput>;

export default IssueCreateOrConnectWithoutCommentsInputSchema;
