/**
 * React Environment Test
 *
 * Simple test to verify React hooks work properly in the test environment
 * This should pass if our React setup is correct.
 */

import { render, screen } from "@testing-library/react";
import React, { useState } from "react";
import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom";

function SimpleComponent() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <span data-testid="count">Count: {count}</span>
      <button
        onClick={() => {
          setCount((c) => c + 1);
        }}
      >
        Increment
      </button>
    </div>
  );
}

describe("React Environment Test", () => {
  it("should render component with useState hook", () => {
    render(<SimpleComponent />);

    expect(screen.getByTestId("count")).toHaveTextContent("Count: 0");
    expect(screen.getByRole("button")).toHaveTextContent("Increment");
  });

  it("should verify React is properly loaded", () => {
    // This test verifies React is available globally
    expect(typeof React).toBe("object");
    expect(typeof React.useState).toBe("function");
  });
});
