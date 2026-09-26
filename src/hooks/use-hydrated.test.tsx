import { render, renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { useHydrated } from "~/hooks/use-hydrated";

function TestComponent(): React.JSX.Element {
  const isHydrated = useHydrated();
  return (
    <div data-testid="status">
      {isHydrated ? "client-hydrated" : "server-rendered"}
    </div>
  );
}

describe("useHydrated", () => {
  it("returns false during server rendering (renderToString)", () => {
    const html = renderToString(<TestComponent />);
    expect(html).toContain("server-rendered");
    expect(html).not.toContain("client-hydrated");
  });

  it("returns true on client-side render", () => {
    const { result } = renderHook(() => useHydrated());
    expect(result.current).toBe(true);
  });

  it("renders hydrated status on client DOM", () => {
    const { getByTestId } = render(<TestComponent />);
    expect(getByTestId("status").textContent).toBe("client-hydrated");
  });
});
