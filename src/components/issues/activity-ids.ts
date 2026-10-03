/**
 * The Activity heading's id, shared by the server-rendered heading and the
 * client islands that move focus to it (after a comment is deleted, or when a
 * comment link's target is missing). A plain module so both sides read the
 * same string — a constant exported from a "use client" file reaches a Server
 * Component as a client reference, not a string.
 */
export const ACTIVITY_HEADING_ID = "issue-activity-heading";
