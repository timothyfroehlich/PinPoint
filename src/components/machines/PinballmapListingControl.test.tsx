import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PinballmapListingControl } from "./PinballmapListingControl";
import {
  linkPinballmapEntryAction,
  verifyPinballmapLinkAction,
} from "~/app/(app)/m/pinballmap-actions";
import { err } from "~/lib/result";

// The control imports the server actions at module scope; stub them so the test
// never pulls the "use server" module (db, Supabase) into jsdom. State rendering
// (class H) is the bug class here — no submission required.
vi.mock("~/app/(app)/m/pinballmap-actions", () => ({
  linkPinballmapEntryAction: vi.fn(),
  verifyPinballmapLinkAction: vi.fn(),
}));

const base = {
  machineId: "m-1",
  hasCatalogLink: true,
  pinballmapUrl: "https://pinballmap.com/map/?by_location_id=26454",
};

describe("PinballmapListingControl", () => {
  it("renders nothing until a catalog title is linked", () => {
    const { container } = render(
      <PinballmapListingControl
        {...base}
        hasCatalogLink={false}
        listed={false}
        lmxId={null}
        canLink
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the listed state with a Verify action when linked", () => {
    render(<PinballmapListingControl {...base} listed lmxId={900} canLink />);
    expect(screen.getByText("Listed")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /verify link/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /open on pinballmap/i })
    ).toHaveAttribute("href", base.pinballmapUrl);
  });

  it("hides Verify but keeps the deep link when the viewer cannot link", () => {
    render(
      <PinballmapListingControl {...base} listed lmxId={900} canLink={false} />
    );
    expect(screen.getByText("Listed")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /verify link/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /open on pinballmap/i })
    ).toBeInTheDocument();
  });

  it("offers Connect to PinballMap when not yet listed", () => {
    render(
      <PinballmapListingControl {...base} listed={false} lmxId={null} canLink />
    );
    expect(screen.getByText("Not listed")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /connect to pinballmap/i })
    ).toBeInTheDocument();
  });

  it("shows a read-only not-listed state (no Connect button) without link permission", () => {
    render(
      <PinballmapListingControl
        {...base}
        listed={false}
        lmxId={null}
        canLink={false}
      />
    );
    expect(
      screen.queryByRole("button", { name: /connect to pinballmap/i })
    ).not.toBeInTheDocument();
    expect(screen.getByText(/not listed on pinballmap/i)).toBeInTheDocument();
  });

  it("surfaces a failed verify's message instead of failing silently", async () => {
    vi.mocked(verifyPinballmapLinkAction).mockResolvedValue(
      err(
        "SERVER",
        "Couldn't reach Pinball Map to re-check this link. Its listing status may be out of date — try again shortly."
      )
    );
    render(<PinballmapListingControl {...base} listed lmxId={900} canLink />);

    await userEvent.click(screen.getByRole("button", { name: /verify link/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/couldn't reach pinball map/i);
  });

  it("surfaces a failed link's message (non-ABSENT) instead of failing silently", async () => {
    vi.mocked(linkPinballmapEntryAction).mockResolvedValue(
      err(
        "SERVER",
        "Another cabinet of this title is already linked as the PinballMap lister for our location"
      )
    );
    render(
      <PinballmapListingControl {...base} listed={false} lmxId={null} canLink />
    );

    await userEvent.click(
      screen.getByRole("button", { name: /connect to pinballmap/i })
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/already linked as the pinballmap lister/i);
  });

  it("keeps the friendly ABSENT copy (no duplicate alert) when the title isn't on the lineup", async () => {
    vi.mocked(linkPinballmapEntryAction).mockResolvedValue(
      err(
        "ABSENT",
        "This machine isn't on PinballMap's lineup for our location yet"
      )
    );
    render(
      <PinballmapListingControl {...base} listed={false} lmxId={null} canLink />
    );

    await userEvent.click(
      screen.getByRole("button", { name: /connect to pinballmap/i })
    );

    // ABSENT renders its own actionable status copy, not the generic alert.
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        /isn't on pinballmap's lineup/i
      )
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
