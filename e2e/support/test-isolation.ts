/**
 * Test Isolation Utilities for Parallel E2E Tests
 *
 * Provides unique identifiers per test worker to prevent conflicts when
 * running tests in parallel against the same database.
 *
 * Usage:
 * - getTestPrefix(): Unique prefix for identifying test-created resources
 * - getTestEmail(base): Generate email with worker-specific suffix
 * - getTestMachineInitials(): Generate unique machine initials
 */

// Worker index from Playwright (0-N based on workers config)
const workerIndex = process.env.TEST_WORKER_INDEX ?? "0";

// Unique run identifier (changes every test run)
const runId = Date.now().toString(36).slice(-4);

/**
 * Get a unique prefix for this test worker/run combination
 *
 * Example output: "w0_kg5x" (worker 0, run ID kg5x)
 */
export function getTestPrefix(): string {
  return `w${workerIndex}_${runId}`;
}

/**
 * Generate a unique email for a test by adding the test prefix
 *
 * @param base - Base email address (e.g., "test@example.com")
 * @returns Email with worker prefix (e.g., "test+w0_kg5x@example.com")
 */
export function getTestEmail(base: string): string {
  const prefix = getTestPrefix();
  const atIndex = base.indexOf("@");

  if (atIndex === -1) {
    throw new Error(`Invalid email format: ${base}`);
  }

  const local = base.slice(0, atIndex);
  const domain = base.slice(atIndex + 1);

  return `${local}+${prefix}@${domain}`;
}

/**
 * Generate unique machine initials for test-created machines
 *
 * Uses uppercase letters to ensure valid machine initials format.
 * Example output: "TW0" (Test Worker 0) or "TXY" (random)
 */
export function getTestMachineInitials(): string {
  // Use worker index + random chars for uniqueness
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const randomChar1 = chars[Math.floor(Math.random() * chars.length)];
  const randomChar2 = chars[Math.floor(Math.random() * chars.length)];

  return `T${randomChar1}${randomChar2}`;
}

/**
 * Generate a unique issue title that can be used for Mailpit filtering
 *
 * @param baseTitle - Base title for the issue
 * @returns Title with unique prefix for filtering
 */
export function getTestIssueTitle(baseTitle: string): string {
  return `[${getTestPrefix()}] ${baseTitle}`;
}

/**
 * Check if a string contains this worker's test prefix
 *
 * Useful for filtering Mailpit emails or database records
 */
export function hasTestPrefix(value: string): boolean {
  return value.includes(`[${getTestPrefix()}]`);
}

/**
 * Get Mailpit search filter for this worker's emails
 *
 * @returns Subject filter string containing the test prefix
 */
export function getMailpitSubjectFilter(): string {
  return getTestPrefix();
}
