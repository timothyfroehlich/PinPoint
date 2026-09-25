import { z } from "zod";
import { ISSUE_STATUS_VALUES } from "~/lib/issues/status-values";

const quickSearchMachineResultSchema = z.object({
  id: z.string().min(1),
  initials: z.string(),
  name: z.string(),
  modelName: z.string().nullable(),
});

const quickSearchIssueResultSchema = z.object({
  id: z.string().min(1),
  issueNumber: z.number().int(),
  machineInitials: z.string(),
  machineName: z.string(),
  status: z.enum(ISSUE_STATUS_VALUES),
  title: z.string(),
});

export const quickSearchResultsSchema = z.object({
  machines: z.array(quickSearchMachineResultSchema),
  issues: z.array(quickSearchIssueResultSchema),
});

export type QuickSearchMachineResult = z.infer<
  typeof quickSearchMachineResultSchema
>;
export type QuickSearchIssueResult = z.infer<
  typeof quickSearchIssueResultSchema
>;
export type QuickSearchResults = z.infer<typeof quickSearchResultsSchema>;
