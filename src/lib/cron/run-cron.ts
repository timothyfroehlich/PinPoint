import "server-only";
import { NextResponse } from "next/server";
import { assertCronAuthorized } from "~/lib/cron/auth";
import { reportError } from "~/lib/observability/report-error";

/**
 * The one failure status every cron route returns when its job throws.
 *
 * Vercel does not retry a failed cron invocation (it records the response and
 * waits for the next scheduled tick), so the number is for humans reading the
 * log. 500 because the failure is ours to fix, whichever upstream it came from.
 */
export const CRON_FAILURE_STATUS = 500;

/**
 * Shared shell for every `/api/cron/*` route: the CRON_SECRET gate, then the
 * job, with any thrown failure routed to `reportError` (CORE-ARCH-015, PP-a5y).
 *
 * A route that catches to return a clean response hides the failure from
 * Sentry, whose auto-capture only sees uncaught exceptions; a bare `log.error`
 * in the route's own catch made every failure of that job invisible to
 * monitoring. Routes do not catch: let the job throw and this wrapper reports.
 *
 * `fn` returns the JSON body of the success response. A job that finishes
 * without doing its work (an upstream failure surfaced as a result value
 * rather than a throw) must throw so it is reported too.
 *
 * @param actionName Short identifier of the job, e.g. `"opdb.refresh"`. It is
 *   the `action` on the Sentry event and the log entry.
 */
export async function runCron(
  request: Request,
  actionName: string,
  fn: () => Promise<object>
): Promise<NextResponse> {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;

  try {
    return NextResponse.json(await fn());
  } catch (err) {
    reportError(err, { action: actionName });
    return NextResponse.json(
      { error: "Cron job failed", action: actionName },
      { status: CRON_FAILURE_STATUS }
    );
  }
}
