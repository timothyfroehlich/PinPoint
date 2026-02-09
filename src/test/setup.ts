/**
 * Vitest Test Setup
 *
 * Configures testing environment and imports custom matchers.
 */

import "@testing-library/jest-dom/vitest";

// Ensure POSTGRES_URL is set for tests to avoid db/index.ts throwing error
// eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Must catch empty string from vitest.config.ts env spreading
process.env.POSTGRES_URL ||= "postgres://postgres:postgres@localhost:5432/test";

// Mock ResizeObserver
if (typeof window !== "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    // eslint-disable-next-line @typescript-eslint/no-empty-function -- Mocking ResizeObserver
    observe() {}
    // eslint-disable-next-line @typescript-eslint/no-empty-function -- Mocking ResizeObserver
    unobserve() {}
    // eslint-disable-next-line @typescript-eslint/no-empty-function -- Mocking ResizeObserver
    disconnect() {}
  };

  // Mock PointerEvent (required for Radix UI)
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Polyfill PointerEvent if missing
  if (!globalThis.PointerEvent) {
    class PointerEvent extends MouseEvent {
      public height: number;
      public isPrimary: boolean;
      public pointerId: number;
      public pointerType: string;
      public pressure: number;
      public tangentialPressure: number;
      public tiltX: number;
      public tiltY: number;
      public twist: number;
      public width: number;

      constructor(type: string, params: PointerEventInit = {}) {
        super(type, params);
        this.pointerId = params.pointerId ?? 0;
        this.width = params.width ?? 0;
        this.height = params.height ?? 0;
        this.pressure = params.pressure ?? 0;
        this.tangentialPressure = params.tangentialPressure ?? 0;
        this.tiltX = params.tiltX ?? 0;
        this.tiltY = params.tiltY ?? 0;
        this.pointerType = params.pointerType ?? "mouse";
        this.isPrimary = params.isPrimary ?? false;
        this.twist = params.twist ?? 0;
      }
    }

    globalThis.PointerEvent = PointerEvent as any;
  }

  // Mock scrollIntoView
  // eslint-disable-next-line @typescript-eslint/no-empty-function -- Mocking scrollIntoView
  window.HTMLElement.prototype.scrollIntoView = function () {};
}
