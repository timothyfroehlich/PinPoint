import type React from "react";
import Link from "next/link";

import { Button } from "~/components/ui/button";

/**
 * Scoped 404 for the issue detail segment.
 *
 * Shown when an issue number is invalid or the issue does not exist in the
 * database (e.g. a rolled-back submission). Offers the user a direct link to
 * the report page so they can re-submit without hunting for it.
 *
 * Note on machine initials: Next.js does not pass route params to not-found.tsx.
 * The report link therefore falls back to the generic /report page rather than
 * the machine-scoped /report?machine=<initials>. This is intentional — wiring
 * initials reliably from a not-found boundary would require undocumented
 * internal headers. A generic report link is the safest choice here; the
 * machine picker on /report lets the user select the right machine.
 */
export default function IssueNotFound(): React.JSX.Element {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-6xl font-bold text-muted-foreground/20">404</h1>
        <h2 className="mt-4 text-2xl font-semibold">Issue not found</h2>
        <p className="mt-3 text-muted-foreground">
          This issue could not be found. If you received an email link, the
          report may not have been saved — please re-submit.
        </p>
        {/* sm-structural-allow: standalone full-width error page, viewport breakpoint is correct */}
        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-center">
          <Button asChild>
            <Link href="/report">Report an issue</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/issues">Browse all issues</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
