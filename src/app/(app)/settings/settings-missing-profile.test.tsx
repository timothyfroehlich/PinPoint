/**
 * Integration test: authenticated user with no user_profiles row.
 *
 * Regression for PP-etip: the previous code redirected an authenticated user
 * to the login URL when their profile row was missing, causing an infinite
 * redirect loop (login → already-authed → /settings → no profile → login…).
 *
 * The correct behaviour is:
 *   1. Call reportError so the data-integrity gap is visible in Sentry.
 *   2. Call notFound() to render a 404 — no login redirect.
 *
 * Bug class: A (auth/route guard). Cheapest catching layer: integration,
 * following the pattern in machine-info-tab-auth.test.tsx.
 */

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { authUsers } from "~/server/db/schema";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";

// ── Mocks (must be declared before dynamic imports) ────────────────────────

const mockGetUser = vi.fn();
vi.mock("~/lib/supabase/server", () => ({
  createClient: () =>
    Promise.resolve({
      auth: { getUser: mockGetUser },
    }),
}));

vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers([["host", "localhost:3000"]])),
  cookies: () => Promise.resolve({ get: () => undefined }),
}));

const mockNotFound = vi.fn(() => {
  // Next.js notFound() throws internally; simulate that so the page stops.
  throw new Error("NEXT_NOT_FOUND");
});
const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  notFound: () => mockNotFound(),
  redirect: (url: string) => mockRedirect(url),
}));

const mockReportError = vi.fn();
vi.mock("~/lib/observability/report-error", () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
  reportAuthError: vi.fn(),
  serverActionError: vi.fn(),
}));

vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  const db = await getTestDb();
  return { db };
});

// UI components — not exercised in the missing-profile path (notFound throws
// before rendering), but must be resolvable at import time.
vi.mock("~/lib/discord/config", () => ({
  isDiscordIntegrationEnabled: vi.fn().mockResolvedValue(false),
}));
vi.mock("~/lib/auth/internal-accounts", () => ({
  isInternalAccount: vi.fn().mockReturnValue(false),
}));
vi.mock(
  "~/app/(app)/settings/connected-accounts/connected-accounts-section",
  () => ({
    ConnectedAccountsSection: () => null,
  })
);
vi.mock(
  "~/app/(app)/settings/notifications/notification-preferences-form",
  () => ({
    NotificationPreferencesForm: () => null,
  })
);
vi.mock("~/app/(app)/settings/change-password-section", () => ({
  ChangePasswordSection: () => null,
}));
vi.mock("~/app/(app)/settings/delete-account-section", () => ({
  DeleteAccountSection: () => null,
}));
vi.mock("~/app/(app)/settings/account-deletion", () => ({
  getReassignmentTargets: vi.fn().mockResolvedValue([]),
}));
vi.mock("~/components/ui/separator", () => ({ Separator: () => null }));
vi.mock("~/components/layout/PageContainer", () => ({
  PageContainer: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("~/components/layout/PageHeader", () => ({ PageHeader: () => null }));
vi.mock("~/lib/cookies/preferences", () => ({
  getLastIssuesPath: vi.fn().mockResolvedValue("/issues"),
}));

import type React from "react";

// Import AFTER all vi.mock() declarations.
const { default: SettingsPage } = await import("~/app/(app)/settings/page");

// ── Tests ──────────────────────────────────────────────────────────────────

describe("SettingsPage — authenticated user with missing profile (PP-etip)", () => {
  setupTestDb();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls notFound() and reportError — does NOT redirect to login", async () => {
    const userId = randomUUID();
    const email = `missing-profile-${userId}@test.com`;

    // Seed auth.users but intentionally omit user_profiles — the exact
    // scenario where the trigger failed to create the row.
    const db = await getTestDb();
    await db.insert(authUsers).values({ id: userId, email });

    mockGetUser.mockResolvedValue({ data: { user: { id: userId, email } } });

    // The page should throw via notFound() — catch it so the test can assert.
    await expect(SettingsPage()).rejects.toThrow("NEXT_NOT_FOUND");

    // reportError must have been called to surface this in Sentry.
    expect(mockReportError).toHaveBeenCalledOnce();
    const [errorArg, contextArg] = mockReportError.mock.calls[0];
    expect(errorArg).toBeInstanceOf(Error);
    expect((errorArg as Error).message).toMatch(/user_profiles/i);
    expect(contextArg).toMatchObject({
      action: "settings-page.missing-profile",
      userId,
    });

    // The redirect to login must NOT have been called — that's the loop trigger.
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("redirects unauthenticated visitors to login (control path unaffected)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    // The page hits the !user guard and calls redirect() normally.
    // redirect() in Next.js throws internally too.
    mockRedirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(SettingsPage()).rejects.toThrow("NEXT_REDIRECT");

    expect(mockRedirect).toHaveBeenCalledOnce();
    expect(mockRedirect.mock.calls[0][0]).toMatch(/login|signin/i);
    expect(mockNotFound).not.toHaveBeenCalled();
    expect(mockReportError).not.toHaveBeenCalled();
  });
});
