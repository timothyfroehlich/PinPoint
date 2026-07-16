import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PinballmapListingControl } from "./PinballmapListingControl";

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
});
