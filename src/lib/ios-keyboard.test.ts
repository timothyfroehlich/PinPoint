import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { holdKeyboardForUpcomingField } from "./ios-keyboard";

describe("holdKeyboardForUpcomingField", () => {
  let container: HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.append(container);
  });

  afterEach(() => {
    container.remove();
    vi.useRealTimers();
  });

  it("focuses a text field inside the container", () => {
    holdKeyboardForUpcomingField(container);

    const proxy = container.querySelector("input");
    expect(proxy).not.toBeNull();
    expect(proxy).toHaveFocus();
  });

  it("removes the field once focus moves to the real one", () => {
    const real = document.createElement("textarea");
    container.append(real);
    holdKeyboardForUpcomingField(container);

    real.focus();

    expect(container.querySelector("input")).toBeNull();
    expect(real).toHaveFocus();
  });

  it("removes the field after a second if nothing takes focus", () => {
    holdKeyboardForUpcomingField(container);

    vi.advanceTimersByTime(1000);

    expect(container.querySelector("input")).toBeNull();
  });
});
