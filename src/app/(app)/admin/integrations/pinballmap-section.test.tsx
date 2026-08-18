import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PinballMapSection } from "./pinballmap-section";

// Mock useActionState so dispatch and pending are controllable, and the section
// never actually invokes a server action during a unit render.
const mockUseActionState = vi.fn();
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof React>();
  return {
    ...actual,
    useActionState: (fn: unknown, initial: unknown) =>
      mockUseActionState(fn, initial),
  };
});

// The actions module is `"use server"` + server-only deps; mock it away.
vi.mock("./pinballmap-actions", () => ({
  savePinballMapConfigAction: vi.fn(),
  syncPinballMapNowAction: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

const HEALTH_OK = {
  lastSyncedAt: "2026-08-17T10:00:00.000Z",
  lastSyncAttemptAt: "2026-08-17T10:00:00.000Z",
  lastSyncStatus: "ok" as const,
  lastSyncError: null,
  machineCount: 12,
};

const ALLOWANCE_FULL = { remaining: 3, nextRefillAt: null };

let dispatch: ReturnType<typeof vi.fn>;

function renderSection(
  overrides: Partial<React.ComponentProps<typeof PinballMapSection>> = {}
): void {
  render(
    <PinballMapSection
      enabled={true}
      locationId={26454}
      locationUrl="https://pinballmap.com/map/?by_location_id=26454"
      health={HEALTH_OK}
      allowance={ALLOWANCE_FULL}
      {...overrides}
    />
  );
}

describe("PinballMapSection", () => {
  beforeEach(() => {
    dispatch = vi.fn();
    mockUseActionState.mockReturnValue([undefined, dispatch, false]);
  });

  it("renders the sync-health readout (§4.2)", () => {
    renderSection();
    expect(screen.getByText("Last successful sync")).toBeInTheDocument();
    expect(screen.getByText("OK")).toBeInTheDocument();
    expect(screen.getByText("Machines in snapshot")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("links out to the location's Pinball Map page (§4.4)", () => {
    renderSection();
    const link = screen.getByRole("link", { name: /view on pinball map/i });
    expect(link).toHaveAttribute(
      "href",
      "https://pinballmap.com/map/?by_location_id=26454"
    );
  });

  it("disables Save until something changes (§2.3)", async () => {
    renderSection();
    expect(
      screen.getByRole("button", { name: /save changes/i })
    ).toBeDisabled();

    await userEvent.click(screen.getByRole("switch"));
    expect(screen.getByRole("button", { name: /save changes/i })).toBeEnabled();
  });

  it("disables Sync now with a countdown when the allowance is spent (§4.3)", async () => {
    renderSection({
      allowance: {
        remaining: 0,
        nextRefillAt: new Date(Date.now() + 45_000).toISOString(),
      },
    });
    await waitFor(() => {
      const button = screen.getByRole("button", { name: /sync now/i });
      expect(button).toBeDisabled();
      expect(button).toHaveTextContent(/sync now \(\d+s\)/i);
    });
  });

  it("confirms a location change before saving, naming Missing and Lingering (§6.8)", async () => {
    renderSection();
    const input = screen.getByLabelText(/location id/i);
    await userEvent.clear(input);
    await userEvent.type(input, "12345");
    await userEvent.click(
      screen.getByRole("button", { name: /save changes/i })
    );

    // The confirm opens; the save is NOT dispatched yet.
    expect(
      screen.getByRole("alertdialog", {
        name: /change tracked location to 12345/i,
      })
    ).toBeInTheDocument();
    expect(screen.getByText(/Missing/)).toBeInTheDocument();
    expect(screen.getByText(/Lingering/)).toBeInTheDocument();
    expect(dispatch).not.toHaveBeenCalled();

    // Confirming dispatches the save.
    await userEvent.click(
      screen.getByRole("button", { name: /^change location$/i })
    );
    expect(dispatch).toHaveBeenCalledTimes(1);
  });
});
