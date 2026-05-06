/**
 * Regression test for PP-lql:
 * A controlled native <select> whose `value` does not match any of its
 * <option>s does NOT silently coerce to a valid value — and the form's
 * FormData reflects the rendering reality (the option the browser ended
 * up displaying), not the React-state intent.
 *
 * This test pins down the silent-fallback footgun that caused two production
 * reports of /report submitting issues against the alphabetically-first
 * machine instead of the user's selection.
 */

import React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

interface MachineOption {
  id: string;
  name: string;
}

function MachineSelectHarness({
  value,
  machines,
}: {
  value: string;
  machines: MachineOption[];
}): React.JSX.Element {
  return (
    <form data-testid="harness">
      <select name="machineId" value={value} onChange={() => undefined}>
        <option value="" disabled>
          Select a machine...
        </option>
        {machines.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
    </form>
  );
}

describe("Native <select> with stale controlled value (PP-lql)", () => {
  const machines: MachineOption[] = [
    { id: "11111111-1111-4111-8111-111111111111", name: "Addams Family" },
    { id: "22222222-2222-4222-8222-222222222222", name: "Medieval Madness" },
    { id: "33333333-3333-4333-8333-333333333333", name: "Twilight Zone" },
  ];

  it("submits the first option's value when controlled value matches no option", () => {
    const stale = "ffffffff-ffff-4fff-8fff-ffffffffffff";

    const { getByTestId } = render(
      <MachineSelectHarness value={stale} machines={machines} />
    );

    const form = getByTestId("harness") as HTMLFormElement;
    const formData = new FormData(form);
    const submittedMachineId = formData.get("machineId");

    // The bug: the form serializes a DIFFERENT machine than the React state intended.
    // We assert the unsafe-fallback so any future regression that "fixes" this at
    // the harness level is intentional and reviewable.
    expect(submittedMachineId).not.toBe(stale);
    expect(submittedMachineId).toBe(machines[0]?.id);
  });

  it("submits the disabled placeholder's value (empty) when controlled value is empty", () => {
    const { getByTestId } = render(
      <MachineSelectHarness value="" machines={machines} />
    );

    const form = getByTestId("harness") as HTMLFormElement;
    const formData = new FormData(form);

    // When value="", the disabled empty placeholder is "selected" and submission
    // would be blocked by `required` in the real form. This is the safe path.
    expect(formData.get("machineId")).toBe("");
  });

  it("submits the matching option's value when controlled value is valid", () => {
    const validId = machines[1]?.id ?? "";

    const { getByTestId } = render(
      <MachineSelectHarness value={validId} machines={machines} />
    );

    const form = getByTestId("harness") as HTMLFormElement;
    const formData = new FormData(form);

    expect(formData.get("machineId")).toBe(validId);
  });
});
