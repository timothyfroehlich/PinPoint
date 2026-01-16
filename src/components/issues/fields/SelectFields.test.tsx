import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { StatusSelect } from "~/components/issues/fields/StatusSelect";
import { SeveritySelect } from "~/components/issues/fields/SeveritySelect";
import { PrioritySelect } from "~/components/issues/fields/PrioritySelect";
import { ConsistencySelect } from "~/components/issues/fields/ConsistencySelect";
import {
  STATUS_CONFIG,
  SEVERITY_CONFIG,
  PRIORITY_CONFIG,
  CONSISTENCY_CONFIG,
} from "~/lib/issues/status";

describe("Select Fields Accessibility", () => {
  it("StatusSelect should have dynamic aria-label", () => {
    const value = "new";
    render(<StatusSelect value={value} onValueChange={vi.fn()} />);

    const trigger = screen.getByTestId("issue-status-select");
    expect(trigger).toHaveAttribute("aria-label", `Status: ${STATUS_CONFIG[value].label}`);
  });

  it("SeveritySelect should have dynamic aria-label", () => {
    const value = "major";
    render(<SeveritySelect value={value} onValueChange={vi.fn()} />);

    const trigger = screen.getByTestId("issue-severity-select");
    expect(trigger).toHaveAttribute("aria-label", `Severity: ${SEVERITY_CONFIG[value].label}`);
  });

  it("PrioritySelect should have dynamic aria-label", () => {
    const value = "high";
    render(<PrioritySelect value={value} onValueChange={vi.fn()} />);

    const trigger = screen.getByTestId("issue-priority-select");
    expect(trigger).toHaveAttribute("aria-label", `Priority: ${PRIORITY_CONFIG[value].label}`);
  });

  it("ConsistencySelect should have dynamic aria-label", () => {
    const value = "constant";
    render(<ConsistencySelect value={value} onValueChange={vi.fn()} />);

    const trigger = screen.getByTestId("issue-consistency-select");
    expect(trigger).toHaveAttribute("aria-label", `Consistency: ${CONSISTENCY_CONFIG[value].label}`);
  });
});
