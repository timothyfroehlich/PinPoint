import React, { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  useUnsavedChangesGuard,
  UnsavedChangesGuard,
} from "./use-unsaved-changes-guard";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "~/components/ui/dropdown-menu";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

function dispatchBeforeUnload(): Event {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event;
}

function dispatchPopState(): Event {
  const event = new Event("popstate");
  window.dispatchEvent(event);
  return event;
}

function TestComponent({
  isDirty,
  onDiscard,
  onPopState,
  title,
  description,
  discardLabel,
  stayLabel,
}: {
  isDirty: boolean;
  onDiscard?: () => void;
  onPopState?: () => void;
  title?: string | ((href: string | null) => string);
  description?: React.ReactNode | ((href: string | null) => React.ReactNode);
  discardLabel?: string | ((href: string | null) => string);
  stayLabel?: string;
}): React.JSX.Element {
  const guard = useUnsavedChangesGuard({
    isDirty,
    onDiscard,
    onPopState,
    title,
    description,
    discardLabel,
    stayLabel,
  });

  return (
    <div>
      <button type="button" onClick={() => guard.openConfirm("/manual-target")}>
        Manual Trigger
      </button>
      <button type="button" onClick={() => guard.openConfirm(null)}>
        Cancel Button
      </button>
      {guard.dialog}
    </div>
  );
}

describe("useUnsavedChangesGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("when not dirty (isDirty = false)", () => {
    it("does not prevent default on beforeunload", () => {
      render(<TestComponent isDirty={false} />);
      const event = dispatchBeforeUnload();
      expect(event.defaultPrevented).toBe(false);
    });

    it("does not intercept anchor clicks", async () => {
      const user = userEvent.setup();
      const linkClickSpy = vi.fn();

      render(
        <div>
          <a href="/target" onClick={linkClickSpy}>
            Go to Target
          </a>
          <TestComponent isDirty={false} />
        </div>
      );

      await user.click(screen.getByRole("link", { name: "Go to Target" }));
      expect(linkClickSpy).toHaveBeenCalled();
      expect(
        screen.queryByText(/discard unsaved changes\?/i)
      ).not.toBeInTheDocument();
      expect(pushMock).not.toHaveBeenCalled();
    });

    it("does not fire onPopState callback", () => {
      const onPopState = vi.fn();
      render(<TestComponent isDirty={false} onPopState={onPopState} />);
      dispatchPopState();
      expect(onPopState).not.toHaveBeenCalled();
    });
  });

  describe("when dirty (isDirty = true)", () => {
    it("prevents default on beforeunload", () => {
      render(<TestComponent isDirty={true} />);
      const event = dispatchBeforeUnload();
      expect(event.defaultPrevented).toBe(true);
    });

    it("fires onPopState callback on browser back/forward", () => {
      const onPopState = vi.fn();
      render(<TestComponent isDirty={true} onPopState={onPopState} />);
      dispatchPopState();
      expect(onPopState).toHaveBeenCalledTimes(1);
    });

    it("intercepts in-app link clicks, opens dialog, and allows onClick propagation", async () => {
      const user = userEvent.setup();
      const linkClickSpy = vi.fn();

      render(
        <div>
          <a href="/target-page" onClick={linkClickSpy}>
            Navigate Away
          </a>
          <TestComponent isDirty={true} />
        </div>
      );

      await user.click(screen.getByRole("link", { name: "Navigate Away" }));

      // The click event MUST propagate to the link's own React onClick handler
      // (PP-kny4: fixes drawer / dropdown menu closing)
      expect(linkClickSpy).toHaveBeenCalled();

      // Dialog should be open
      expect(screen.getByText("Discard unsaved changes?")).toBeInTheDocument();
      expect(
        screen.getByText(
          "You have unsaved changes on this page. If you leave now, those changes will be lost."
        )
      ).toBeInTheDocument();
      expect(pushMock).not.toHaveBeenCalled();
    });

    it("navigates and calls onDiscard when user confirms discard", async () => {
      const user = userEvent.setup();
      const onDiscard = vi.fn();

      render(
        <div>
          <a href="/destination">Target Link</a>
          <TestComponent isDirty={true} onDiscard={onDiscard} />
        </div>
      );

      await user.click(screen.getByRole("link", { name: "Target Link" }));
      expect(screen.getByText("Discard unsaved changes?")).toBeInTheDocument();

      const discardBtn = screen.getByRole("button", {
        name: "Discard and leave",
      });
      await user.click(discardBtn);

      expect(onDiscard).toHaveBeenCalledTimes(1);
      expect(pushMock).toHaveBeenCalledWith("/destination");
    });

    it("cancels discard and stays on page when user clicks Stay", async () => {
      const user = userEvent.setup();
      const onDiscard = vi.fn();

      render(
        <div>
          <a href="/destination">Target Link</a>
          <TestComponent isDirty={true} onDiscard={onDiscard} />
        </div>
      );

      await user.click(screen.getByRole("link", { name: "Target Link" }));
      expect(screen.getByText("Discard unsaved changes?")).toBeInTheDocument();

      const stayBtn = screen.getByRole("button", { name: "Stay on page" });
      await user.click(stayBtn);

      expect(onDiscard).not.toHaveBeenCalled();
      expect(pushMock).not.toHaveBeenCalled();
    });

    it("does not intercept external origin links", async () => {
      const user = userEvent.setup();
      render(
        <div>
          <a href="https://example.com/external">External Link</a>
          <TestComponent isDirty={true} />
        </div>
      );

      await user.click(screen.getByRole("link", { name: "External Link" }));
      expect(
        screen.queryByText(/discard unsaved changes\?/i)
      ).not.toBeInTheDocument();
    });

    it("does not intercept target='_blank' links", async () => {
      const user = userEvent.setup();
      render(
        <div>
          <a href="/target" target="_blank" rel="noreferrer">
            New Tab Link
          </a>
          <TestComponent isDirty={true} />
        </div>
      );

      await user.click(screen.getByRole("link", { name: "New Tab Link" }));
      expect(
        screen.queryByText(/discard unsaved changes\?/i)
      ).not.toBeInTheDocument();
    });

    it("does not intercept download links", async () => {
      const user = userEvent.setup();
      render(
        <div>
          <a href="/file.pdf" download>
            Download File
          </a>
          <TestComponent isDirty={true} />
        </div>
      );

      await user.click(screen.getByRole("link", { name: "Download File" }));
      expect(
        screen.queryByText(/discard unsaved changes\?/i)
      ).not.toBeInTheDocument();
    });

    it("supports custom resolved titles, descriptions, and labels", async () => {
      const user = userEvent.setup();

      render(
        <div>
          <a href="/custom-destination">Custom Link</a>
          <TestComponent
            isDirty={true}
            title={(href) => (href ? "Leaving so soon?" : "Discard?")}
            description={(href) =>
              href ? `Heading to ${href}` : "Resetting inputs"
            }
            discardLabel={(href) => (href ? "Yes, leave" : "Yes, reset")}
            stayLabel="Nevermind"
          />
        </div>
      );

      await user.click(screen.getByRole("link", { name: "Custom Link" }));

      expect(screen.getByText("Leaving so soon?")).toBeInTheDocument();
      expect(
        screen.getByText("Heading to /custom-destination")
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Yes, leave" })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Nevermind" })
      ).toBeInTheDocument();
    });

    it("supports manual openConfirm for in-form cancel buttons without navigation", async () => {
      const user = userEvent.setup();
      const onDiscard = vi.fn();

      render(<TestComponent isDirty={true} onDiscard={onDiscard} />);

      await user.click(screen.getByRole("button", { name: "Cancel Button" }));

      expect(screen.getByText("Discard unsaved changes?")).toBeInTheDocument();
      // Default label for null pendingHref is "Discard changes"
      const discardBtn = screen.getByRole("button", {
        name: "Discard changes",
      });
      await user.click(discardBtn);

      expect(onDiscard).toHaveBeenCalledTimes(1);
      // No navigation when pendingHref was null
      expect(pushMock).not.toHaveBeenCalled();
    });

    it("clears lastInterceptedLink so manual openConfirm does not refocus previous link, and skips refocus on confirmed discard", async () => {
      const user = userEvent.setup();
      render(
        <div>
          <a href="/target-tab">Tab Link</a>
          <TestComponent isDirty={true} />
        </div>
      );

      const tabLink = screen.getByRole("link", { name: "Tab Link" });
      const cancelBtn = screen.getByRole("button", { name: "Cancel Button" });

      // 1. Intercept link click
      await user.click(tabLink);
      expect(screen.getByText("Discard unsaved changes?")).toBeInTheDocument();

      // 2. Choose "Stay on page"
      await user.click(screen.getByRole("button", { name: "Stay on page" }));
      expect(
        screen.queryByText("Discard unsaved changes?")
      ).not.toBeInTheDocument();
      expect(document.activeElement).toBe(tabLink);

      // 3. Now trigger openConfirm(null) via Cancel button
      await user.click(cancelBtn);
      expect(screen.getByText("Discard unsaved changes?")).toBeInTheDocument();

      // 4. Cancel dialog closes — focus must NOT jump to the old tab link
      await user.click(screen.getByRole("button", { name: "Stay on page" }));
      expect(
        screen.queryByText("Discard unsaved changes?")
      ).not.toBeInTheDocument();
      expect(document.activeElement).not.toBe(tabLink);

      // 5. Intercept link click again, then confirm discard
      await user.click(tabLink);
      const tabLinkFocusSpy = vi.spyOn(tabLink, "focus");
      await user.click(
        screen.getByRole("button", { name: "Discard and leave" })
      );
      expect(pushMock).toHaveBeenCalledWith("/target-tab");
      // Focus must NOT be forced on the leaving page's link
      expect(tabLinkFocusSpy).not.toHaveBeenCalled();
    });
  });

  describe("UnsavedChangesGuard declarative component", () => {
    function DeclarativeForm(): React.JSX.Element {
      const [dirty, setDirty] = useState(false);
      return (
        <div>
          <button type="button" onClick={() => setDirty(true)}>
            Edit Form
          </button>
          <a href="/other">Leave</a>
          <UnsavedChangesGuard isDirty={dirty} />
        </div>
      );
    }

    it("renders and functions correctly when dropped directly in JSX", async () => {
      const user = userEvent.setup();
      render(<DeclarativeForm />);

      // Clean: click does not trigger guard
      await user.click(screen.getByRole("link", { name: "Leave" }));
      expect(
        screen.queryByText(/discard unsaved changes\?/i)
      ).not.toBeInTheDocument();

      // Dirty: click triggers guard
      await user.click(screen.getByRole("button", { name: "Edit Form" }));
      await user.click(screen.getByRole("link", { name: "Leave" }));
      expect(screen.getByText("Discard unsaved changes?")).toBeInTheDocument();
    });
  });

  describe("Radix DropdownMenu integration", () => {
    function DropdownMenuForm({
      isDirty,
    }: {
      isDirty: boolean;
    }): React.JSX.Element {
      return (
        <div>
          <UnsavedChangesGuard isDirty={isDirty} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button">Open Menu</button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem asChild>
                <a href="/target">Menu Link</a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    }

    it("dismisses open Radix dropdown menu when an item link is intercepted, and remains closed after cancel", async () => {
      const user = userEvent.setup();
      render(<DropdownMenuForm isDirty={true} />);

      await user.click(screen.getByRole("button", { name: "Open Menu" }));
      expect(
        screen.getByRole("menuitem", { name: "Menu Link" })
      ).toBeInTheDocument();

      await user.click(screen.getByRole("menuitem", { name: "Menu Link" }));

      // Discard dialog should open
      expect(screen.getByText("Discard unsaved changes?")).toBeInTheDocument();

      // Choose "Stay on page"
      await user.click(screen.getByRole("button", { name: "Stay on page" }));
      expect(
        screen.queryByText("Discard unsaved changes?")
      ).not.toBeInTheDocument();

      // Menu should NOT remain open
      expect(
        screen.queryByRole("menuitem", { name: "Menu Link" })
      ).not.toBeInTheDocument();
    });
  });
});
