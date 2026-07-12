import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MachinePinballmapCard } from "./machine-pinballmap-card";

const LOCATION_URL = "https://pinballmap.com/map/?by_location_id=26454";

describe("MachinePinballmapCard", () => {
  it("renders a public link back to the PBM location (CORE-PBM-001)", () => {
    render(<MachinePinballmapCard locationUrl={LOCATION_URL} />);
    const link = screen.getByTestId("machine-pinballmap-link");
    expect(link).toHaveTextContent(/view on pinballmap/i);
    expect(link).toHaveAttribute("href", LOCATION_URL);
    expect(link).toHaveAttribute("target", "_blank");
    // noopener noreferrer to match the codebase convention for target="_blank".
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});
