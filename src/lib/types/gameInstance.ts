/**
 * Machine types for issue-related operations
 */

/**
 * Game instance data shape returned by the getAllForIssues tRPC endpoint
 * Used across components that display or work with game instances in issue contexts
 */
export interface MachineForIssues {
  id: string;
  name: string;
  model: {
    name: string;
  };
}
