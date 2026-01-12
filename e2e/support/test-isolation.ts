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

// Worker index from Playwright (0-based index of the worker)
const workerIndex = process.env.TEST_PARALLEL_INDEX ?? "0";

/**
 * Get a unique prefix for this test worker/run combination
 *
 * Example output: "w0_kg5x" (worker 0, run ID kg5x)
 *
 * The identifier includes the worker index plus a short timestamp- and
 * randomness-based suffix to avoid collisions when workers start together.
 */
export function getTestPrefix(): string {
  const timestampPart = Date.now().toString(36).slice(-4);
  const randomPart = Math.random().toString(36).slice(2, 6);
  const runId = `${timestampPart}${randomPart}`;
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
 * Combines the worker index with a random character for uniqueness.
 * Example output: "T0X" (Test Worker 0 with random suffix)
 */
export function getTestMachineInitials(): string {
  // Use worker index + random char for uniqueness across workers
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const randomChar = chars[Math.floor(Math.random() * chars.length)];

  return `T${workerIndex}${randomChar}`;
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
