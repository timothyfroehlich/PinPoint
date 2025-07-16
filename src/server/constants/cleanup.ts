/**
 * Configuration constants for comment cleanup functionality
 */
export const COMMENT_CLEANUP_CONFIG = {
  /**
   * Number of days after soft deletion before comments are permanently deleted
   */
  RETENTION_DAYS: 90,
} as const;
