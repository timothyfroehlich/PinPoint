/**
 * The most characters an issue title may hold — the same when reporting,
 * editing on the issue page, converting a Pinball Map comment, or writing
 * through MCP (spec issue-detail §4.4). Older titles over the limit are never
 * shortened automatically; they save again only once edited down.
 */
export const ISSUE_TITLE_MAX = 60;

export const ISSUE_TITLE_MAX_MESSAGE = `Title must be ${ISSUE_TITLE_MAX} characters or less`;
