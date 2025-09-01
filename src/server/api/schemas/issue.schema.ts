import { z } from "zod";
import { titleSchema, emailSchema } from "../../../lib/validation/schemas";
import { ISSUE_SORT_OPTIONS } from "~/lib/types/filters";

/**
 * Issue Creation Schema
 * Core schema for creating issues with additional validation
 */
export const issueCreateSchema = z.object({
  title: titleSchema,
  description: z.string().optional(),
  machineId: z.string().min(1, "Machine ID is required"),
  submitterName: z.string().optional(),
  reporterEmail: emailSchema.optional(),
  organizationId: z.string().min(1, "Organization ID is required").optional(),
});

/**
 * Issue Update Schema
 * Schema for updating existing issues
 */
export const issueUpdateSchema = z.object({
  id: z.string().min(1, "Issue ID is required"),
  title: titleSchema.optional(),
  description: z.string().min(1).nullable().optional(),
  statusId: z.string().optional(),
  assignedToId: z.string().optional(),
  priorityId: z.string().optional(),
});

/**
 * Issue Filter Schema
 * Enhanced validation for complex filtering operations
 */
export const issueFilterSchema = z.object({
  locationId: z.string().optional(),
  machineId: z.string().optional(),
  statusIds: z.array(z.string()).optional(),
  search: z.string().optional(),
  assigneeId: z.string().optional(),
  reporterId: z.string().optional(),
  ownerId: z.string().optional(),
  modelId: z.string().optional(),
  statusId: z.string().optional(),
  priorityIds: z.array(z.string()).optional(),
  limit: z.number().min(1).max(1000).optional(),
  offset: z.number().min(0).optional(),
  sortBy: z.enum(ISSUE_SORT_OPTIONS).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  statusCategory: z.string().optional(),
});

/**
 * Issue Assignment Schema
 * For assigning issues to users
 */
export const issueAssignSchema = z.object({
  issueId: z.string().min(1, "Issue ID is required"),
  userId: z.string().min(1, "User ID is required"),
});

/**
 * Issue Status Update Schema
 * For updating issue status
 */
export const issueStatusUpdateSchema = z.object({
  id: z.string().min(1, "Issue ID is required"),
  statusId: z.string().min(1, "Status ID is required"),
});

/**
 * Public Issue Creation Schema
 * For public-facing issue creation with additional validation
 */
export const publicIssueCreateSchema = z.object({
  title: titleSchema,
  description: z.string().optional(),
  machineId: z.string().min(1, "Machine ID is required"),
  submitterName: z.string().optional(),
  reporterEmail: emailSchema,
});

/**
 * Output validation schemas corresponding to API response transformers
 */
export const issueResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  machineId: z.string(),
  organizationId: z.string(),
  statusId: z.string(),
  priorityId: z.string(),
  assignedToId: z.string().nullable(),
  createdById: z.string(),
  resolvedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  _count: z
    .object({
      comments: z.number(),
      attachments: z.number(),
    })
    .optional(),
});

export const issueWithRelationsSchema = issueResponseSchema.extend({
  machine: z
    .object({
      id: z.string(),
      name: z.string().nullable(),
      model: z.object({
        id: z.string(),
        name: z.string(),
        manufacturer: z.string(),
        year: z.number().nullable(),
      }),
      location: z.object({
        id: z.string(),
        name: z.string(),
        address: z.string().nullable(),
      }),
    })
    .nullable(),
  status: z
    .object({
      id: z.string(),
      name: z.string(),
      color: z.string().nullable(),
    })
    .nullable(),
  priority: z
    .object({
      id: z.string(),
      name: z.string(),
      level: z.number(),
      color: z.string().nullable(),
    })
    .nullable(),
  assignedTo: z
    .object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
    })
    .nullable(),
  createdBy: z
    .object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
    })
    .nullable(),
  comments: z
    .array(
      z.object({
        id: z.string(),
        content: z.string(),
        authorId: z.string(),
        createdAt: z.date(),
        updatedAt: z.date(),
      }),
    )
    .optional(),
  attachments: z
    .array(
      z.object({
        id: z.string(),
        fileName: z.string(),
        fileType: z.string(),
        createdAt: z.date(),
      }),
    )
    .optional(),
});
