import { describe, it, expect } from "vitest";
import {
  getIssueRootMessageId,
  getThreadingHeaders,
} from "~/lib/notifications/email-threading";

describe("getIssueRootMessageId", () => {
  it("returns a stable Message-ID in angle-bracket format", () => {
    expect(getIssueRootMessageId("PP-1234")).toBe(
      "<issue-PP-1234@pinpoint.app>"
    );
  });

  it("is deterministic — same input always returns same ID", () => {
    expect(getIssueRootMessageId("MM-42")).toBe(getIssueRootMessageId("MM-42"));
  });

  it("differs per issue ID", () => {
    expect(getIssueRootMessageId("PP-1")).not.toBe(
      getIssueRootMessageId("PP-2")
    );
  });
});

describe("getThreadingHeaders", () => {
  it("returns inReplyTo and references pointing to the same root ID", () => {
    const headers = getThreadingHeaders("PP-1234");
    expect(headers.inReplyTo).toBe("<issue-PP-1234@pinpoint.app>");
    expect(headers.references).toBe("<issue-PP-1234@pinpoint.app>");
  });

  it("inReplyTo and references are always equal (single-root threading)", () => {
    const headers = getThreadingHeaders("TZ-99");
    expect(headers.inReplyTo).toBe(headers.references);
  });

  it("returns different headers for different issue IDs", () => {
    const a = getThreadingHeaders("PP-1");
    const b = getThreadingHeaders("PP-2");
    expect(a.inReplyTo).not.toBe(b.inReplyTo);
    expect(a.references).not.toBe(b.references);
  });
});
