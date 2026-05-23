import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MachineTimelineActionsRow } from "./MachineTimelineActionsRow";

vi.mock("~/app/(app)/m/[initials]/(tabs)/timeline/actions", () => ({
  addMachineCommentAction: vi.fn(() => Promise.resolve({ success: true })),
}));

vi.mock("~/components/editor/RichTextEditor", () => ({
  RichTextEditor: () => null,
}));

// `next/navigation` hooks are used by the filter component; stub them so the
// filter renders cleanly in jsdom without an App-Router context.
vi.mock("next/navigation", () => ({
  usePathname: () => "/m/AFM/timeline",
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("MachineTimelineActionsRow", () => {
  it("renders the filter trigger and (when canCompose) the New entry button", () => {
    render(
      <MachineTimelineActionsRow
        machineId="m1"
        currentTags={[]}
        canCompose={true}
      />
    );
    expect(
      screen.getByRole("button", { name: /filter by tag/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /new entry/i })
    ).toBeInTheDocument();
  });

  it("hides the New entry button when canCompose is false", () => {
    render(
      <MachineTimelineActionsRow
        machineId="m1"
        currentTags={[]}
        canCompose={false}
      />
    );
    expect(
      screen.queryByRole("button", { name: /new entry/i })
    ).not.toBeInTheDocument();
  });

  it("expands to the composer form on click and hides the New entry trigger", async () => {
    const user = userEvent.setup();
    render(
      <MachineTimelineActionsRow
        machineId="m1"
        currentTags={[]}
        canCompose={true}
      />
    );
    // Collapsed: no Post button.
    expect(
      screen.queryByRole("button", { name: /post/i })
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /new entry/i }));
    expect(screen.getByRole("button", { name: /post/i })).toBeInTheDocument();
    // The New entry trigger is hidden once composing — there is no Cancel,
    // so the only escape is to Post.
    expect(
      screen.queryByRole("button", { name: /new entry/i })
    ).not.toBeInTheDocument();
  });
});
