/** Base URL of the Discord REST API version every PinPoint call targets. */
export const DISCORD_API = "https://discord.com/api/v10";

/**
 * Per-attempt budget for every Discord REST call (PP-az4d.25); the same as
 * `@discordjs/rest`'s default request timeout.
 */
export const DISCORD_TIMEOUT_MS = 15_000;
