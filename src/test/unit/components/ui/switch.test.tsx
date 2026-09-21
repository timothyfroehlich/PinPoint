/**
 * Regression guard for PP-bhd7.7 on `SwitchWithFormSupport` (exported as
 * `Switch` from `~/components/ui/switch`).
 *
 * The form-support Switch renders a hidden `<input>` so an *unchecked* toggle
 * can still submit an explicit "off" (a native unchecked checkbox submits
 * nothing, and the notification-preferences action needs to tell "off" apart
 * from "absent"). The defect: that hidden input rendered unconditionally, so a
 * *disabled* Switch also submitted a value — the opposite of a native disabled
 * checkbox, which is excluded from submission entirely. That silently
 * overwrote saved state (the Discord toggles while the account is unlinked),
 * and the original fix lived at one call site instead of in the component.
 *
 * These tests read the real constructed FormData set for a `<form>`, so they
 * exercise both the custom hidden input and Radix's own bubble input.
 */
import React from "react";
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { Switch } from "~/components/ui/switch";

function formDataFor(ui: React.ReactElement): FormData {
  const { container } = render(<form>{ui}</form>);
  const form = container.querySelector("form");
  if (!form) throw new Error("form not found");
  return new FormData(form);
}

describe("SwitchWithFormSupport form submission", () => {
  it("submits 'on' when enabled and checked", () => {
    const data = formDataFor(<Switch name="notify" defaultChecked />);
    expect(data.get("notify")).toBe("on");
  });

  it("submits an explicit 'off' when enabled and unchecked", () => {
    // This is why the hidden input exists at all: a native unchecked checkbox
    // would submit nothing, but the action must distinguish "off" from absent.
    const data = formDataFor(<Switch name="notify" />);
    expect(data.get("notify")).toBe("off");
  });

  it("contributes nothing to FormData when disabled", () => {
    const data = formDataFor(<Switch name="notify" defaultChecked disabled />);
    expect(data.has("notify")).toBe(false);
    expect(data.get("notify")).toBeNull();
  });

  it("contributes nothing when disabled and controlled (the production shape)", () => {
    // The notification form drives the Discord switch controlled
    // (checked={...} + disabled) rather than uncontrolled, so pin that shape.
    const data = formDataFor(
      <Switch
        name="notify"
        checked
        disabled
        onCheckedChange={() => undefined}
      />
    );
    expect(data.has("notify")).toBe(false);
  });

  it("matches a native disabled checkbox: neither contributes a value", () => {
    const data = formDataFor(
      <>
        <Switch name="switchField" defaultChecked disabled />
        <input type="checkbox" name="nativeField" defaultChecked disabled />
      </>
    );
    expect(data.has("switchField")).toBe(false);
    expect(data.has("nativeField")).toBe(false);
  });

  it("emits no submission field when rendered without a name", () => {
    const data = formDataFor(<Switch defaultChecked />);
    expect([...data.keys()]).toHaveLength(0);
  });
});
