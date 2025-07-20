import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { MembershipCreateNestedManyWithoutOrganizationInputSchema } from "./MembershipCreateNestedManyWithoutOrganizationInputSchema";
import { LocationCreateNestedManyWithoutOrganizationInputSchema } from "./LocationCreateNestedManyWithoutOrganizationInputSchema";
import { RoleCreateNestedManyWithoutOrganizationInputSchema } from "./RoleCreateNestedManyWithoutOrganizationInputSchema";
import { MachineCreateNestedManyWithoutOrganizationInputSchema } from "./MachineCreateNestedManyWithoutOrganizationInputSchema";
import { IssueCreateNestedManyWithoutOrganizationInputSchema } from "./IssueCreateNestedManyWithoutOrganizationInputSchema";
import { PriorityCreateNestedManyWithoutOrganizationInputSchema } from "./PriorityCreateNestedManyWithoutOrganizationInputSchema";
import { IssueStatusCreateNestedManyWithoutOrganizationInputSchema } from "./IssueStatusCreateNestedManyWithoutOrganizationInputSchema";
import { CollectionTypeCreateNestedManyWithoutOrganizationInputSchema } from "./CollectionTypeCreateNestedManyWithoutOrganizationInputSchema";
import { IssueHistoryCreateNestedManyWithoutOrganizationInputSchema } from "./IssueHistoryCreateNestedManyWithoutOrganizationInputSchema";
import { AttachmentCreateNestedManyWithoutOrganizationInputSchema } from "./AttachmentCreateNestedManyWithoutOrganizationInputSchema";

export const OrganizationCreateWithoutPinballMapConfigInputSchema: z.ZodType<Prisma.OrganizationCreateWithoutPinballMapConfigInput> =
  z
    .object({
      id: z.string().cuid().optional(),
      name: z.string(),
      subdomain: z.string().optional().nullable(),
      logoUrl: z.string().optional().nullable(),
      createdAt: z.coerce.date().optional(),
      updatedAt: z.coerce.date().optional(),
      memberships: z
        .lazy(() => MembershipCreateNestedManyWithoutOrganizationInputSchema)
        .optional(),
      locations: z
        .lazy(() => LocationCreateNestedManyWithoutOrganizationInputSchema)
        .optional(),
      roles: z
        .lazy(() => RoleCreateNestedManyWithoutOrganizationInputSchema)
        .optional(),
      machines: z
        .lazy(() => MachineCreateNestedManyWithoutOrganizationInputSchema)
        .optional(),
      issues: z
        .lazy(() => IssueCreateNestedManyWithoutOrganizationInputSchema)
        .optional(),
      priorities: z
        .lazy(() => PriorityCreateNestedManyWithoutOrganizationInputSchema)
        .optional(),
      issueStatuses: z
        .lazy(() => IssueStatusCreateNestedManyWithoutOrganizationInputSchema)
        .optional(),
      collectionTypes: z
        .lazy(
          () => CollectionTypeCreateNestedManyWithoutOrganizationInputSchema,
        )
        .optional(),
      issueHistory: z
        .lazy(() => IssueHistoryCreateNestedManyWithoutOrganizationInputSchema)
        .optional(),
      attachments: z
        .lazy(() => AttachmentCreateNestedManyWithoutOrganizationInputSchema)
        .optional(),
    })
    .strict() as z.ZodType<Prisma.OrganizationCreateWithoutPinballMapConfigInput>;

export default OrganizationCreateWithoutPinballMapConfigInputSchema;
