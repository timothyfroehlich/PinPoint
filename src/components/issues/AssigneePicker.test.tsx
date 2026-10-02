import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { AssigneePicker } from "./AssigneePicker";
import React from "react";
import { mockMobileViewport } from "~/test/helpers/viewport";

const mockUsers = [
  { id: "1", name: "Alice" },
  { id: "2", name: "Bob" },
  { id: "3", name: "Carol" },
];

describe("AssigneePicker Accessibility", () => {
  it("renders with correct accessibility attributes", () => {
    const onAssign = vi.fn();
    render(
      <AssigneePicker
        assignedToId={null}
        users={mockUsers}
        isPending={false}
        onAssign={onAssign}
      />
    );

    const trigger = screen.getByTestId("assignee-picker-trigger");
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");

    // Check hidden SVG
    const svg = trigger.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("renders listbox options with correct roles and data-assigned", () => {
    const onAssign = vi.fn();
    render(
      <AssigneePicker
        assignedToId="1"
        users={mockUsers}
        isPending={false}
        onAssign={onAssign}
      />
    );

    const trigger = screen.getByTestId("assignee-picker-trigger");
    fireEvent.click(trigger);

    // The popup is a named dialog holding the search box and the listbox.
    const popup = screen.getByRole("dialog", { name: "Assignee" });
    const listbox = within(popup).getByRole("listbox");
    expect(listbox).toBeInTheDocument();
    // A listbox may own only options and groups (axe aria-required-children).
    expect(listbox.querySelector('[role="separator"]')).toBeNull();

    const searchInput = screen.getByTestId("assignee-search-input");
    expect(searchInput).toHaveAttribute("aria-label", "Filter users");

    const unassignedOption = screen.getByTestId("assignee-option-unassigned");
    expect(unassignedOption).toHaveAttribute("role", "option");
    // data-assigned is the stable signal this test uses for current assignee
    // state; this assertion intentionally does not rely on aria-selected
    // (which cmdk owns and uses for keyboard highlight).
    expect(unassignedOption).toHaveAttribute("data-assigned", "false");

    const aliceOption = screen.getByTestId("assignee-option-1");
    expect(aliceOption).toHaveAttribute("role", "option");
    expect(aliceOption).toHaveAttribute("data-assigned", "true");

    const bobOption = screen.getByTestId("assignee-option-2");
    expect(bobOption).toHaveAttribute("role", "option");
    expect(bobOption).toHaveAttribute("data-assigned", "false");
  });

  it("renders loading state with accessible attributes", () => {
    const onAssign = vi.fn();
    render(
      <AssigneePicker
        assignedToId="1"
        users={mockUsers}
        isPending={true}
        onAssign={onAssign}
      />
    );

    // The row stays named for its value while it saves, and can't reopen.
    // It is aria-disabled rather than disabled so it keeps keyboard focus.
    const trigger = screen.getByRole("button", { name: "Assignee: Alice" });
    expect(trigger).toHaveAttribute("aria-disabled", "true");
    expect(trigger).not.toBeDisabled();
    fireEvent.click(trigger);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});

describe("AssigneePicker — Me quick-select", () => {
  it("shows 'Me' option when currentUserId matches a user in the list", () => {
    const onAssign = vi.fn();
    render(
      <AssigneePicker
        assignedToId={null}
        users={mockUsers}
        isPending={false}
        onAssign={onAssign}
        currentUserId="1"
      />
    );

    fireEvent.click(screen.getByTestId("assignee-picker-trigger"));

    const meOption = screen.getByTestId("assignee-option-me");
    expect(meOption).toBeInTheDocument();
    expect(meOption).toHaveTextContent("Me");
  });

  it("does NOT show 'Me' option when currentUserId is null", () => {
    const onAssign = vi.fn();
    render(
      <AssigneePicker
        assignedToId={null}
        users={mockUsers}
        isPending={false}
        onAssign={onAssign}
        currentUserId={null}
      />
    );

    fireEvent.click(screen.getByTestId("assignee-picker-trigger"));

    expect(screen.queryByTestId("assignee-option-me")).not.toBeInTheDocument();
  });

  it("does NOT show 'Me' option when currentUserId prop is omitted", () => {
    const onAssign = vi.fn();
    render(
      <AssigneePicker
        assignedToId={null}
        users={mockUsers}
        isPending={false}
        onAssign={onAssign}
      />
    );

    fireEvent.click(screen.getByTestId("assignee-picker-trigger"));

    expect(screen.queryByTestId("assignee-option-me")).not.toBeInTheDocument();
  });

  it("selecting 'Me' calls onAssign with the current user's ID", () => {
    const onAssign = vi.fn();
    render(
      <AssigneePicker
        assignedToId={null}
        users={mockUsers}
        isPending={false}
        onAssign={onAssign}
        currentUserId="2"
      />
    );

    fireEvent.click(screen.getByTestId("assignee-picker-trigger"));
    fireEvent.click(screen.getByTestId("assignee-option-me"));

    expect(onAssign).toHaveBeenCalledOnce();
    expect(onAssign).toHaveBeenCalledWith("2");
  });

  it("finds and selects the current user by name in addition to 'Me'", () => {
    const onAssign = vi.fn();
    render(
      <AssigneePicker
        assignedToId={null}
        users={mockUsers}
        isPending={false}
        onAssign={onAssign}
        currentUserId="1"
      />
    );

    fireEvent.click(screen.getByTestId("assignee-picker-trigger"));

    fireEvent.change(screen.getByTestId("assignee-search-input"), {
      target: { value: "ali" },
    });

    // The quick-select remains visible while the alphabetical list is filtered.
    expect(screen.getByTestId("assignee-option-me")).toBeInTheDocument();
    const aliceOption = screen.getByTestId("assignee-option-1");
    expect(aliceOption).toBeInTheDocument();
    expect(screen.queryByTestId("assignee-option-2")).not.toBeInTheDocument();
    expect(screen.queryByTestId("assignee-option-3")).not.toBeInTheDocument();

    fireEvent.click(aliceOption);

    expect(onAssign).toHaveBeenCalledOnce();
    expect(onAssign).toHaveBeenCalledWith("1");
  });

  it("marks 'Me' with data-assigned when the current user is assigned", () => {
    const onAssign = vi.fn();
    render(
      <AssigneePicker
        assignedToId="1"
        users={mockUsers}
        isPending={false}
        onAssign={onAssign}
        currentUserId="1"
      />
    );

    fireEvent.click(screen.getByTestId("assignee-picker-trigger"));

    const meOption = screen.getByTestId("assignee-option-me");
    expect(meOption).toHaveAttribute("data-assigned", "true");
  });

  it("does NOT show 'Me' when currentUserId does not match any user in the list", () => {
    const onAssign = vi.fn();
    render(
      <AssigneePicker
        assignedToId={null}
        users={mockUsers}
        isPending={false}
        onAssign={onAssign}
        currentUserId="999"
      />
    );

    fireEvent.click(screen.getByTestId("assignee-picker-trigger"));

    expect(screen.queryByTestId("assignee-option-me")).not.toBeInTheDocument();
  });
});

describe("AssigneePicker — current assignee", () => {
  function open(
    assignedToId: string | null,
    onAssign: (userId: string | null) => void = vi.fn()
  ): HTMLElement {
    render(
      <AssigneePicker
        assignedToId={assignedToId}
        users={mockUsers}
        isPending={false}
        onAssign={onAssign}
        currentUserId="1"
      />
    );
    fireEvent.click(screen.getByTestId("assignee-picker-trigger"));
    return screen.getByRole("listbox");
  }

  it.each([
    ["Bob", "2", "assignee-option-2"],
    ["Unassigned", null, "assignee-option-unassigned"],
    ["Me", "1", "assignee-option-me"],
  ] as const)(
    "starts the highlight on the current assignee (%s), not the first row",
    async (_label, assignedToId, testId) => {
      const listbox = open(assignedToId);
      await waitFor(() => {
        expect(
          within(listbox)
            .getAllByRole("option")
            .filter((option) => option.getAttribute("aria-selected") === "true")
            .map((option) => option.getAttribute("data-testid"))
        ).toEqual([testId]);
      });
    }
  );

  it("marks only the current assignee's rows with a check", () => {
    const listbox = open("2");
    const checked = within(listbox)
      .getAllByRole("option")
      .filter((option) => option.querySelector("svg.lucide-check"))
      .map((option) => option.getAttribute("data-testid"));
    expect(checked).toEqual(["assignee-option-2"]);
  });

  it.each([
    ["Bob, choosing Bob", "2", "assignee-option-2"],
    ["no one, choosing Unassigned", null, "assignee-option-unassigned"],
    ["me, choosing Me", "1", "assignee-option-me"],
    ["me, choosing my own name", "1", "assignee-option-1"],
  ] as const)(
    "closes without saving when the choice is who is already assigned (%s)",
    (_label, assignedToId, testId) => {
      const onAssign = vi.fn();
      open(assignedToId, onAssign);

      fireEvent.click(screen.getByTestId(testId));

      expect(onAssign).not.toHaveBeenCalled();
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    }
  );

  it("keeps the no-matches message out of the listbox (axe aria-required-children)", () => {
    const listbox = open(null);
    fireEvent.change(screen.getByTestId("assignee-search-input"), {
      target: { value: "zed" },
    });

    const message = screen
      .getAllByText("No matches")
      .filter((element) => element.getAttribute("role") !== "status");
    expect(message).toHaveLength(1);
    expect(listbox).not.toHaveTextContent("No matches");
    for (const child of listbox.querySelectorAll("[cmdk-list-sizer] > *")) {
      expect(child.getAttribute("role")).toMatch(
        /^(option|group|presentation)$/
      );
    }
  });

  it("announces how many people match the filter", () => {
    open(null);
    const search = screen.getByTestId("assignee-search-input");

    fireEvent.change(search, { target: { value: "o" } });
    expect(screen.getByRole("status")).toHaveTextContent("2 matches");
    fireEvent.change(search, { target: { value: "car" } });
    expect(screen.getByRole("status")).toHaveTextContent("1 match");
    fireEvent.change(search, { target: { value: "zed" } });
    expect(screen.getByRole("status")).toHaveTextContent("No matches");
  });
});

describe("AssigneePicker — phones (spec issue-detail §9.4, §13.2)", () => {
  let restoreViewport: (() => void) | undefined;
  afterEach(() => {
    restoreViewport?.();
  });

  it("opens a bottom sheet with the search box first", async () => {
    restoreViewport = mockMobileViewport(true);
    const onAssign = vi.fn();
    render(
      <AssigneePicker
        assignedToId={null}
        users={mockUsers}
        isPending={false}
        onAssign={onAssign}
        currentUserId="1"
      />
    );

    fireEvent.click(screen.getByTestId("assignee-picker-trigger"));

    const sheet = await screen.findByTestId("assignee-drawer");
    expect(
      within(sheet).getByRole("heading", { name: "Assignee" })
    ).toBeInTheDocument();
    const search = within(sheet).getByTestId("assignee-search-input");
    const listbox = within(sheet).getByRole("listbox");
    // The search box comes before the list.
    expect(
      search.compareDocumentPosition(listbox) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    await waitFor(() => {
      expect(search).toHaveFocus();
    });

    fireEvent.click(within(sheet).getByTestId("assignee-option-me"));
    expect(onAssign).toHaveBeenCalledWith("1");
  });
});
