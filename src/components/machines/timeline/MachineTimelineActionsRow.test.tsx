import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MachineTimelineActionsRow } from "./MachineTimelineActionsRow";

vi.mock("~/app/(app)/m/[initials]/(tabs)/timeline/actions", () => ({
  addMachineCommentAction: vi.fn(() => Promise.resolve({ success: true })),
}));

// RichTextEditor (Tiptap) is heavy and only mounts once the sheet opens.
vi.mock("~/components/editor/RichTextEditor", () => ({
  RichTextEditor: () => null,
}));

// The filter is the shared MultiSelect (Popover + cmdk) — needs these jsdom
// stubs, same as MachineTimelineFilter.test.tsx.
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
vi.stubGlobal("ResizeObserver", MockResizeObserver);
Element.prototype.scrollIntoView = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/m/AFM/timeline",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("MachineTimelineActionsRow", () => {
  it("renders the filter trigger and the New Note action when canCompose", () => {
    render(
      <MachineTimelineActionsRow
        machineId="m1"
        machineName="Attack From Mars"
        currentTags={[]}
        canCompose={true}
      />
    );
    expect(
      screen.getByRole("combobox", { name: /filter by tag/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /new note/i })
    ).toBeInTheDocument();
  });

  it("hides the New Note action when canCompose is false", () => {
    render(
      <MachineTimelineActionsRow
        machineId="m1"
        machineName="Attack From Mars"
        currentTags={[]}
        canCompose={false}
      />
    );
    expect(
      screen.queryByRole("button", { name: /new note/i })
    ).not.toBeInTheDocument();
    // Filter is always present regardless of compose permission.
    expect(
      screen.getByRole("combobox", { name: /filter by tag/i })
    ).toBeInTheDocument();
  });

  it("opens the composer in a sheet when New Note is clicked", async () => {
    const user = userEvent.setup();
    render(
      <MachineTimelineActionsRow
        machineId="m1"
        machineName="Attack From Mars"
        currentTags={[]}
        canCompose={true}
      />
    );
    // Sheet is closed initially — no Post button mounted.
    expect(
      screen.queryByRole("button", { name: /^post$/i })
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /new note/i }));
    // The composer (with its Post button) is now mounted inside the sheet.
    expect(
      await screen.findByRole("button", { name: /^post$/i })
    ).toBeInTheDocument();
  });
});
