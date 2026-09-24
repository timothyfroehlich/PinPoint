/**
 * Vitest Test Setup
 *
 * Configures testing environment and imports custom matchers.
 */

import "@testing-library/jest-dom/vitest";
import { EventEmitter } from "node:events";

import { installMemoryStorageIfMissing } from "~/test/memory-storage";

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

  // Some hosts surface `localStorage` as undefined in the jsdom unit
  // environment (opaque-origin / storage-disabled jsdom), so a suite's
  // `beforeEach(() => localStorage.clear())` throws before any assertion —
  // green in CI, red on those machines (PP-2s37). Provide an in-memory
  // Storage only when one is genuinely missing, mirroring the pointer-capture
  // no-op polyfills above: a no-op where jsdom already supplies real storage,
  // so it can never mask a working implementation. Accessing the property can
  // itself throw under an opaque origin, hence the try/catch.
  installMemoryStorageIfMissing();

  // jsdom cannot navigate between Documents, so anchor clicks and
  // window.location assignments exercised in component tests (e.g. the
  // SettingsTab nav-guard suite, NotificationList link clicks) emit a noisy
  // "Not implemented: navigation to another Document" jsdomError on every
  // test run. Rewire the virtual console's jsdomError forwarding to drop
  // exactly that message class — every other jsdomError (unhandled
  // exceptions, CSS parse errors, other not-implemented APIs) still reaches
  // the console unchanged. Intercepting here (rather than preventDefault-ing
  // anchor clicks in the suites) keeps event semantics intact for tests that
  // assert on defaultPrevented. (PP-at9m)
  const virtualConsole: unknown = Reflect.get(window, "_virtualConsole");
  if (virtualConsole instanceof EventEmitter) {
    const forwarders = virtualConsole.listeners("jsdomError");
    virtualConsole.removeAllListeners("jsdomError");
    virtualConsole.on("jsdomError", (...args: unknown[]) => {
      const [error] = args;
      if (
        error instanceof Error &&
        error.message === "Not implemented: navigation to another Document"
      ) {
        return;
      }
      for (const forward of forwarders) {
        // Preserve the original `this === virtualConsole` binding that
        // EventEmitter gives listeners; a captured forwarder may rely on it.
        forward.apply(virtualConsole, args);
      }
    });
  }
}
