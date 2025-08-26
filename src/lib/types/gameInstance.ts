/**
 * Machine types for issue-related operations
 */

/**
 * Game instance data shape returned by the getAllForIssues tRPC endpoint.
 * Used across components that display or work with game instances in issue contexts.
 *
 * This interface represents the camelCase version of machine data for issue contexts,
 * following the boundary convention where application-layer types use camelCase
 * while database operations use snake_case.
 */
export interface MachineForIssues {
  id: string;
  name: string;
  model: {
    name: string;
  };
}
