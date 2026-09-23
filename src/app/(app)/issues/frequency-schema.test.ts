import { describe, expect, it } from "vitest";
import { exportFiltersSchema } from "./export-schema";
import { updateIssueFrequencySchema } from "./schemas";
import { parseIssueFilters } from "~/lib/issues/filters";

describe("Not specified frequency across issue surfaces", () => {
  it("accepts the value for issue editing", () => {
    const result = updateIssueFrequencySchema.safeParse({
      issueId: "11111111-1111-4111-8111-111111111111",
      frequency: "not_specified",
    });
    expect(result.success).toBe(true);
  });

  it("preserves the value in list and export filters", () => {
    const filter = { frequency: ["not_specified"] };
    expect(exportFiltersSchema.parse(filter).frequency).toEqual(
      filter.frequency
    );
    expect(
      parseIssueFilters(new URLSearchParams("frequency=not_specified"))
        .frequency
    ).toEqual(filter.frequency);
  });
});
