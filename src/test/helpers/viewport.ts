import { vi } from "vitest";

/**
 * Stand in for the viewport's `(max-width: 767px)` media query, which jsdom
 * doesn't implement. `useIsMobile` reads it through `window.matchMedia`, so
 * this drives the hook through its real seam. Returns a restore function.
 */
export function mockMobileViewport(isMobile: boolean): () => void {
  const original = Object.getOwnPropertyDescriptor(window, "matchMedia");
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: isMobile,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
  return () => {
    if (original) {
      Object.defineProperty(window, "matchMedia", original);
    } else {
      Reflect.deleteProperty(window, "matchMedia");
    }
  };
}
