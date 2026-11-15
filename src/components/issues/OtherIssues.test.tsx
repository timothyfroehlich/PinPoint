import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { parseIssueViewState } from "~/lib/issues/view/state";
import { OtherIssues } from "./OtherIssues";

describe("OtherIssues", () => {
  it("links See all to the machine's issues in every status and presence state (issue-detail §10.3)", () => {
    render(
      <OtherIssues
        issues={[]}
        machineName="Attack from Mars"
        machineInitials="AFM"
      />
    );

    const href = screen
      .getByRole("link", { name: "See all" })
      .getAttribute("href");
    expect(href).toBe("/issues?machine=AFM&status=all&presence=all");

    const url = new URL(href ?? "", "https://pinpoint.test");
    expect(parseIssueViewState(url.searchParams)).toMatchObject({
      machine: ["AFM"],
      status: [],
      presence: [],
    });
  });
});
