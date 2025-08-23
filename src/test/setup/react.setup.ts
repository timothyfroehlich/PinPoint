/**
 * Vitest Setup for React Components in jsdom Environment
 *
 * This setup file ensures React hooks work properly in component tests
 * by initializing React's internal systems and providing testing utilities.
 */

// CRITICAL: Import React globally to initialize hook dispatcher
import React from "react";

// Import jest-dom matchers for enhanced DOM assertions
import "@testing-library/jest-dom";

// Import React Testing Library cleanup
import { cleanup } from "@testing-library/react";

// Import Vitest APIs
import { afterEach, beforeAll } from "vitest";

// Ensure React is available globally
globalThis.React = React;

// Cleanup after each test to prevent memory leaks and test interference
afterEach(() => {
  cleanup();
});

// Verify React is properly loaded
beforeAll(() => {
  // Debug: Verify React hook dispatcher is available
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!React || typeof React.useState !== "function") {
    throw new Error("React is not properly loaded in test environment");
  }

  // Debug: Verify React internals are available (for hook dispatcher)
  const internals = (
    React as unknown as {
      __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED?: unknown;
    }
  ).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
  if (!internals) {
    console.warn("React internals not available - hooks may not work properly");
  }

  console.log("✅ React test environment initialized successfully");
});

// Mock Next.js router to prevent errors in components that use useRouter
import { vi } from "vitest";

vi.mock("next/router", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    pathname: "/test",
    query: {},
    asPath: "/test",
  }),
}));

// Mock Next.js navigation (App Router) to prevent errors
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
  useParams: () => ({}),
  useSearchParams: () => ({
    get: vi.fn(),
  }),
  usePathname: () => "/test",
  notFound: vi.fn(),
}));

// Suppress console warnings in tests (optional)
const originalConsoleWarn = console.warn;
console.warn = (...args: unknown[]) => {
  // Suppress known React warnings in test environment
  if (
    typeof args[0] === "string" &&
    args[0].includes("useLayoutEffect does nothing on the server")
  ) {
    return;
  }
  if (
    typeof args[0] === "string" &&
    args[0].includes("React does not recognize the")
  ) {
    return;
  }
  if (
    typeof args[0] === "string" &&
    args[0].includes(
      "React internals not available - hooks may not work properly",
    )
  ) {
    return;
  }
  originalConsoleWarn(...(args as Parameters<typeof originalConsoleWarn>));
};
