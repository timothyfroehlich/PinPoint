import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SeveritySelect } from "./SeveritySelect";
import { StatusSelect } from "./StatusSelect";
import { PrioritySelect } from "./PrioritySelect";
import { ConsistencySelect } from "./ConsistencySelect";
import React from "react";

// Mock ResizeObserver for Radix UI
globalThis.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock scrollIntoView for Radix UI
window.HTMLElement.prototype.scrollIntoView = vi.fn();

describe("Issue Field Selects Accessibility", () => {
  it("SeveritySelect has dynamic accessible name", () => {
    const onValueChange = vi.fn();
    render(
      <SeveritySelect
        value="major"
        onValueChange={onValueChange}
      />
    );
    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveAttribute("aria-label", "Severity: Major");
  });

  it("StatusSelect has dynamic accessible name", () => {
    const onValueChange = vi.fn();
    render(
      <StatusSelect
        value="in_progress"
        onValueChange={onValueChange}
      />
    );
    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveAttribute("aria-label", "Status: In Progress");
  });

  it("PrioritySelect has dynamic accessible name", () => {
    const onValueChange = vi.fn();
    render(
      <PrioritySelect
        value="high"
        onValueChange={onValueChange}
      />
    );
    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveAttribute("aria-label", "Priority: High");
  });

  it("ConsistencySelect has dynamic accessible name", () => {
    const onValueChange = vi.fn();
    render(
      <ConsistencySelect
        value="frequent"
        onValueChange={onValueChange}
      />
    );
    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveAttribute("aria-label", "Consistency: Frequent");
  });
});
