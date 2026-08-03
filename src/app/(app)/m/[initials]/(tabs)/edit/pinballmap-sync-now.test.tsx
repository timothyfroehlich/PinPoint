import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PinballmapSyncNow } from "./pinballmap-sync-now";
import { syncPinballMapNowAction } from "~/app/(app)/m/pinballmap-actions";
import { err, ok } from "~/lib/result";

// The component imports the server action at module scope; stub it so the
// test never pulls the "use server" module (db, Supabase) into jsdom, and
// never reaches pinballmap.com (CORE-PBM-001 — mock at the SDK boundary).
vi.mock("~/app/(app)/m/pinballmap-actions", () => ({
  syncPinballMapNowAction: vi.fn(),
}));

describe("PinballmapSyncNow", () => {
  it("surfaces a throttled sync's message as an announced alert instead of failing silently", async () => {
    vi.mocked(syncPinballMapNowAction).mockResolvedValue(
      err(
        "THROTTLED",
        "Pinball Map was just refreshed. Please wait a moment before syncing again."
      )
    );
    render(<PinballmapSyncNow />);

    await userEvent.click(screen.getByRole("button", { name: /sync now/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/just refreshed/i);
  });

  it("shows no alert on a successful sync", async () => {
    vi.mocked(syncPinballMapNowAction).mockResolvedValue(
      ok({ machineCount: 42, healed: 0, linked: 0 })
    );
    render(<PinballmapSyncNow />);

    await userEvent.click(screen.getByRole("button", { name: /sync now/i }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /sync now/i })
      ).not.toBeDisabled()
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
