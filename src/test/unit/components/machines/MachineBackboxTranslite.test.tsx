import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MachineBackboxTranslite } from "~/components/machines/MachineBackboxTranslite";

// next/image isn't needed for these assertions; render a plain img passthrough
// (mirrors AppHeader.test.tsx) so jsdom doesn't run the image optimizer.
vi.mock("next/image", () => ({
  default: ({
    alt,
    src,
    unoptimized,
  }: {
    alt: string;
    src: string;
    unoptimized?: boolean;
  }) => <img alt={alt} src={src} data-unoptimized={unoptimized} />,
}));

describe("MachineBackboxTranslite", () => {
  it("renders the backbox image with an accessible name when a URL is set", () => {
    render(
      <MachineBackboxTranslite
        imageUrl="https://img.opdb.org/godzilla.jpg"
        name="Godzilla"
      />
    );
    const img = screen.getByRole("img");
    expect(img).toHaveAccessibleName(/godzilla/i);
    expect(img).toHaveAttribute("src", "https://img.opdb.org/godzilla.jpg");
    expect(img).toHaveAttribute("data-unoptimized", "true");
    expect(screen.getByRole("link", { name: "OPDB" })).toHaveAttribute(
      "href",
      "https://img.opdb.org/godzilla.jpg"
    );
    expect(
      screen.queryByRole("link", { name: /pinball map/i })
    ).not.toBeInTheDocument();
  });

  it("renders nothing when no image URL exists (chip-only fallback)", () => {
    const { container } = render(
      <MachineBackboxTranslite imageUrl={null} name="Godzilla" />
    );
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByTestId("machine-translite")).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it("is desktop-only (hidden on mobile, shown at md)", () => {
    render(
      <MachineBackboxTranslite
        imageUrl="https://img.opdb.org/godzilla.jpg"
        name="Godzilla"
      />
    );
    expect(screen.getByTestId("machine-translite")).toHaveClass(
      "hidden",
      "md:block"
    );
  });
});
