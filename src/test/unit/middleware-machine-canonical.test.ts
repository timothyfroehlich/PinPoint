import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { middleware } from "../../../middleware";

/**
 * The canonical-casing redirect for `/m/<initials>` short-circuits before the
 * Supabase session refresh, so `updateSession` is stubbed here: these cases
 * assert the wiring in `middleware.ts` (redirect status, Location, and that
 * the session path is skipped), not the pure path logic — that lives in
 * `src/lib/machines/canonical-path.test.ts`.
 */
const updateSessionMock = vi.hoisted(() => vi.fn());

vi.mock("~/lib/supabase/middleware", () => ({
  updateSession: updateSessionMock,
}));

const request = (url: string) => new NextRequest(new URL(url));

describe("middleware machine URL canonicalization", () => {
  it("redirects a lowercase initials segment to the uppercase form", async () => {
    const response = await middleware(request("http://localhost/m/afm"));

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("http://localhost/m/AFM");
    expect(updateSessionMock).not.toHaveBeenCalled();
  });

  it("keeps the sub-path and query string", async () => {
    const response = await middleware(
      request("http://localhost/m/rush/i/12?from=qr")
    );

    expect(response.headers.get("location")).toBe(
      "http://localhost/m/RUSH/i/12?from=qr"
    );
  });
});
