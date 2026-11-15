import { z } from "zod";
import { ISSUE_STATUS_VALUES } from "~/lib/issues/status-values";

const quickSearchMachineResultSchema = z.object({
  id: z.string().min(1),
  initials: z.string(),
  name: z.string(),
  modelName: z.string().nullable(),
});

/**
 * One machine as the browser holds it for matching: the result fields plus
 * the extra model identity fields a query can match (spec 3.1, 7.5).
 */
const quickSearchMachineIndexEntrySchema =
  quickSearchMachineResultSchema.extend({
    manufacturer: z.string().nullable(),
    year: z.string().nullable(),
  });

const quickSearchIssueResultSchema = z.object({
  id: z.string().min(1),
  issueNumber: z.number().int(),
  machineInitials: z.string(),
  machineName: z.string(),
  status: z.enum(ISSUE_STATUS_VALUES),
  title: z.string(),
});

export const quickSearchMachineIndexSchema = z.object({
  machines: z.array(quickSearchMachineIndexEntrySchema),
});

export const quickSearchIssueResultsSchema = z.object({
  issues: z.array(quickSearchIssueResultSchema),
});

export type QuickSearchMachineResult = z.infer<
  typeof quickSearchMachineResultSchema
>;
export type QuickSearchMachineIndexEntry = z.infer<
  typeof quickSearchMachineIndexEntrySchema
>;
export type QuickSearchMachineIndex = z.infer<
  typeof quickSearchMachineIndexSchema
>;
export type QuickSearchIssueResult = z.infer<
  typeof quickSearchIssueResultSchema
>;
export type QuickSearchIssueResults = z.infer<
  typeof quickSearchIssueResultsSchema
>;
