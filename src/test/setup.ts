/**
 * Vitest Test Setup
 *
 * Configures testing environment and imports custom matchers.
 */

import "@testing-library/jest-dom/vitest";

// Mock ResizeObserver
if (typeof window !== "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    observe() {}
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    unobserve() {}
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    disconnect() {}
  };

  // Mock PointerEvent (required for Radix UI)
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    globalThis.PointerEvent = PointerEvent as any;
  }

  // Mock scrollIntoView
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  window.HTMLElement.prototype.scrollIntoView = function () {};
}
