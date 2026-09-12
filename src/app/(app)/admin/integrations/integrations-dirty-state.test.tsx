import * as React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  IntegrationsDirtyStateProvider,
  useIntegrationDirtyState,
} from "./integrations-dirty-state";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

function DirtySection({
  sectionId,
  initiallyDirty = true,
}: {
  sectionId: string;
  initiallyDirty?: boolean;
}): React.JSX.Element {
  const [isDirty, setIsDirty] = React.useState(initiallyDirty);
  useIntegrationDirtyState(sectionId, isDirty);
  return (
    <button type="button" onClick={() => setIsDirty(false)}>
      Reset {sectionId}
    </button>
  );
}

function dispatchBeforeUnload(): Event {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event;
}

describe("IntegrationsDirtyStateProvider", () => {
  beforeEach(() => {
    pushMock.mockReset();
    window.history.replaceState(null, "", "/admin/integrations");
  });

  it("warns on document unload while any section remains dirty", async () => {
    const user = userEvent.setup();
    render(
      <IntegrationsDirtyStateProvider>
        <DirtySection sectionId="discord" />
        <DirtySection sectionId="pinballmap" />
      </IntegrationsDirtyStateProvider>
    );

    await waitFor(() =>
      expect(dispatchBeforeUnload().defaultPrevented).toBe(true)
    );
    await user.click(screen.getByRole("button", { name: "Reset discord" }));
    expect(dispatchBeforeUnload().defaultPrevented).toBe(true);
    await user.click(screen.getByRole("button", { name: "Reset pinballmap" }));
    await waitFor(() =>
      expect(dispatchBeforeUnload().defaultPrevented).toBe(false)
    );
  });

  it("confirms same-app links and restores focus when navigation is canceled", async () => {
    const user = userEvent.setup();
    render(
      <IntegrationsDirtyStateProvider>
        <DirtySection sectionId="discord" />
        <a href="/m?status=active">Machines</a>
      </IntegrationsDirtyStateProvider>
    );
    const link = screen.getByRole("link", { name: "Machines" });

    await user.click(link);
    expect(
      screen.getByRole("alertdialog", { name: "Discard unsaved changes?" })
    ).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Stay on page" }));
    await waitFor(() => expect(link).toHaveFocus());

    await user.click(link);
    await user.click(screen.getByRole("button", { name: "Discard and leave" }));
    expect(pushMock).toHaveBeenCalledWith("/m?status=active");
  });

  it("does not synthesize a browser-Back guard", async () => {
    render(
      <IntegrationsDirtyStateProvider>
        <DirtySection sectionId="discord" />
      </IntegrationsDirtyStateProvider>
    );
    await waitFor(() =>
      expect(dispatchBeforeUnload().defaultPrevented).toBe(true)
    );

    window.dispatchEvent(new PopStateEvent("popstate"));

    expect(pushMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});
