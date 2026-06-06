/**
 * Vitest Test Setup
 *
 * Configures testing environment and imports custom matchers.
 */

import "@testing-library/jest-dom/vitest";

// Ensure POSTGRES_URL is set for tests to avoid db/index.ts throwing error
if (process.env.POSTGRES_URL === undefined || process.env.POSTGRES_URL === "") {
  process.env.POSTGRES_URL = "postgres://postgres:postgres@localhost:5432/test";
}

// Mock ResizeObserver
if (typeof window !== "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  // Mock PointerEvent (required for Radix UI)
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
  window.HTMLElement.prototype.scrollIntoView = function () {};

  // Mock Pointer Capture API — required by vaul drag-to-dismiss and by Radix
  // UI Select (which calls hasPointerCapture/releasePointerCapture on pointer
  // events). jsdom doesn't implement these, so we polyfill no-ops only when
  // they're missing — keeps any real implementation in a future jsdom or alt
  // environment intact.
  if (!window.Element.prototype.setPointerCapture) {
    window.Element.prototype.setPointerCapture = function () {};
  }
  if (!window.Element.prototype.releasePointerCapture) {
    window.Element.prototype.releasePointerCapture = function () {};
  }
  if (!window.Element.prototype.hasPointerCapture) {
    window.Element.prototype.hasPointerCapture = function (): boolean {
      return false;
    };
  }
}
