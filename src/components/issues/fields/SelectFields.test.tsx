import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { StatusSelect } from "./StatusSelect";
import { SeveritySelect } from "./SeveritySelect";
import { PrioritySelect } from "./PrioritySelect";
import { ConsistencySelect } from "./ConsistencySelect";

describe("SelectFields Accessibility", () => {
  describe("StatusSelect", () => {
    it("has a dynamic accessible name including the value", () => {
      render(
        <StatusSelect
          value="in_progress"
          onValueChange={vi.fn()}
        />
      );

      const trigger = screen.getByTestId("issue-status-select");
      expect(trigger).toHaveAttribute("aria-label", "Status: In Progress");
    });
  });

  describe("SeveritySelect", () => {
    it("has a dynamic accessible name including the value", () => {
      render(
        <SeveritySelect
          value="major"
          onValueChange={vi.fn()}
        />
      );

      const trigger = screen.getByTestId("issue-severity-select");
      expect(trigger).toHaveAttribute("aria-label", "Severity: Major");
    });
  });

  describe("PrioritySelect", () => {
    it("has a dynamic accessible name including the value", () => {
      render(
        <PrioritySelect
          value="high"
          onValueChange={vi.fn()}
        />
      );

      const trigger = screen.getByTestId("issue-priority-select");
      expect(trigger).toHaveAttribute("aria-label", "Priority: High");
    });
  });

  describe("ConsistencySelect", () => {
    it("has a dynamic accessible name including the value", () => {
      render(
        <ConsistencySelect
          value="frequent"
          onValueChange={vi.fn()}
        />
      );

      const trigger = screen.getByTestId("issue-consistency-select");
      expect(trigger).toHaveAttribute("aria-label", "Consistency: Frequent");
    });
  });
});
