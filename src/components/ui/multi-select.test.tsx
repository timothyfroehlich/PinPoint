import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { MultiSelect, type Option, type GroupedOption } from "./multi-select";

// Mock ResizeObserver for Radix UI
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
vi.stubGlobal("ResizeObserver", MockResizeObserver);

// Mock scrollIntoView for Radix UI
Element.prototype.scrollIntoView = vi.fn();

const testOptions: Option[] = [
  { label: "Apple", value: "apple" },
  { label: "Banana", value: "banana" },
  { label: "Cherry", value: "cherry" },
];

const testGroups: GroupedOption[] = [
  {
    label: "Fruits",
    options: [
      { label: "Apple", value: "apple" },
      { label: "Banana", value: "banana" },
    ],
  },
  {
    label: "Vegetables",
    options: [
      { label: "Carrot", value: "carrot" },
      { label: "Broccoli", value: "broccoli" },
    ],
  },
];

describe("MultiSelect sorting", () => {
  it("sorts selected items to the top of flat options", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <MultiSelect
        options={testOptions}
        value={["cherry"]}
        onChange={onChange}
        data-testid="multi-select"
      />
    );

    // Open the dropdown
    await user.click(screen.getByRole("combobox"));

    // Get all options in DOM order
    const options = screen.getAllByRole("option");

    // Cherry should be first since it's selected
    expect(options[0]).toHaveTextContent("Cherry");
    // Unselected items maintain their original relative order
    expect(options[1]).toHaveTextContent("Apple");
    expect(options[2]).toHaveTextContent("Banana");
  });

  it("sorts multiple selected items to top while preserving their relative order", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    // Select banana and cherry (not apple)
    render(
      <MultiSelect
        options={testOptions}
        value={["banana", "cherry"]}
        onChange={onChange}
        data-testid="multi-select"
      />
    );

    await user.click(screen.getByRole("combobox"));
    const options = screen.getAllByRole("option");

    // Banana comes before Cherry in the original array, so it stays first among selected
    expect(options[0]).toHaveTextContent("Banana");
    expect(options[1]).toHaveTextContent("Cherry");
    // Apple is unselected, goes to bottom
    expect(options[2]).toHaveTextContent("Apple");
  });

  it("sorts selected items to top within each group", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    // Select banana (fruit) and broccoli (vegetable)
    render(
      <MultiSelect
        groups={testGroups}
        value={["banana", "broccoli"]}
        onChange={onChange}
        data-testid="multi-select"
      />
    );

    await user.click(screen.getByRole("combobox"));
    const options = screen.getAllByRole("option");

    // Fruits group: Banana (selected) should be before Apple
    expect(options[0]).toHaveTextContent("Banana");
    expect(options[1]).toHaveTextContent("Apple");
    // Vegetables group: Broccoli (selected) should be before Carrot
    expect(options[2]).toHaveTextContent("Broccoli");
    expect(options[3]).toHaveTextContent("Carrot");
  });

  it("updates order when selection changes via toggle", async () => {
    const user = userEvent.setup();
    let currentValue: string[] = [];
    const onChange = vi.fn((newValue: string[]) => {
      currentValue = newValue;
    });

    const { rerender } = render(
      <MultiSelect
        options={testOptions}
        value={currentValue}
        onChange={onChange}
        data-testid="multi-select"
      />
    );

    // Open dropdown
    await user.click(screen.getByRole("combobox"));

    // Initially all unselected - original order
    let options = screen.getAllByRole("option");
    expect(options[0]).toHaveTextContent("Apple");
    expect(options[1]).toHaveTextContent("Banana");
    expect(options[2]).toHaveTextContent("Cherry");

    // Click Cherry to select it
    await user.click(screen.getByText("Cherry"));

    // Verify onChange was called with cherry
    expect(onChange).toHaveBeenCalledWith(["cherry"]);

    // Rerender with updated value to simulate controlled component
    rerender(
      <MultiSelect
        options={testOptions}
        value={["cherry"]}
        onChange={onChange}
        data-testid="multi-select"
      />
    );

    // Now Cherry should be first
    options = screen.getAllByRole("option");
    expect(options[0]).toHaveTextContent("Cherry");
    expect(options[1]).toHaveTextContent("Apple");
    expect(options[2]).toHaveTextContent("Banana");
  });
});
