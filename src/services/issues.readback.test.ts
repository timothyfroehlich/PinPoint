import { describe, it, expect } from "vitest";

import {
  assertIssuePersisted,
  IssueCommitVerificationError,
  type IssueExistenceReader,
} from "~/services/issues";

// Unit tests for the post-commit read-back guard (PP-qk7s, incident
// 2026-06-18). `assertIssuePersisted` is extracted from `createIssue` so the
// throw path can be tested deterministically: PGlite transactions always
// persist, making the "row missing" outcome unreachable through `createIssue`
// in integration tests. A minimal typed reader stub covers both outcomes
// without PGlite setup overhead. The happy-path integration coverage (the row
// is committed and findable post-return) lives in the integration suite.
describe("createIssue read-back guard (PP-qk7s)", () => {
  it("assertIssuePersisted resolves when the row exists", async () => {
    const reader: IssueExistenceReader = {
      query: {
        issues: {
          findFirst: () => Promise.resolve({ id: "some-uuid" }),
        },
      },
    };
    await expect(
      assertIssuePersisted(reader, "some-uuid", "STM")
    ).resolves.toBeUndefined();
  });

  it("assertIssuePersisted throws IssueCommitVerificationError when the row is absent", async () => {
    const reader: IssueExistenceReader = {
      query: {
        issues: {
          findFirst: () => Promise.resolve(undefined),
        },
      },
    };
    await expect(
      assertIssuePersisted(reader, "missing-uuid", "STM")
    ).rejects.toThrow(IssueCommitVerificationError);
  });

  it("IssueCommitVerificationError message includes machineInitials and id but not PII", () => {
    const err = new IssueCommitVerificationError("TAF", "test-id-123");
    expect(err.name).toBe("IssueCommitVerificationError");
    expect(err.message).toContain("TAF");
    expect(err.message).toContain("test-id-123");
    // Must not contain anything that looks like an email address.
    expect(err.message).not.toMatch(/@/);
  });
});
