import { describe, expect, it } from "vitest";
import { updateIssueFrequencySchema } from "./schemas";
import { parseIssueViewState } from "~/lib/issues/view/state";

describe("Not specified frequency across issue surfaces", () => {
  it("accepts the value for issue editing", () => {
    const result = updateIssueFrequencySchema.safeParse({
      issueId: "11111111-1111-4111-8111-111111111111",
      frequency: "not_specified",
    });
    expect(result.success).toBe(true);
  });

  it("preserves the value in the list's Frequency filter", () => {
    expect(
      parseIssueViewState(new URLSearchParams("frequency=not_specified"))
        .frequency
    ).toEqual(["not_specified"]);
  });
});
