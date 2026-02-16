import type React from "react";
import Link from "next/link";

import { PageShell } from "~/components/layout/PageShell";

export const metadata = {
  title: "Issue Lifecycle | PinPoint",
};

export default function IssuesHelpPage(): React.JSX.Element {
  return (
    <PageShell size="narrow">
      <header className="space-y-2 mb-8">
        <p className="text-sm text-muted-foreground">
          <Link href="/help" className="text-link">
            Help
          </Link>{" "}
          / Issue Lifecycle
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Issue Lifecycle
        </h1>
        <p className="text-sm text-muted-foreground">
          How issues move from first report to resolution, what each status
          means, and how assignment and watching work.
        </p>
      </header>

      {/* Issue Lifecycle */}
      <section className="space-y-3 mb-8">
        <h2 className="text-lg font-semibold">How an Issue Progresses</h2>
        <p className="text-sm text-muted-foreground">
          When you report an issue, it starts as{" "}
          <span className="font-semibold text-foreground">new</span>. An
          operator confirms it&apos;s a real problem, a technician picks it up
          and works on the repair, and eventually it&apos;s marked as{" "}
          <span className="font-semibold text-foreground">fixed</span> (or
          closed for another reason).
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
          <span className="rounded-md bg-muted px-3 py-1">new</span>
          <span className="text-muted-foreground">&rarr;</span>
          <span className="rounded-md bg-muted px-3 py-1">confirmed</span>
          <span className="text-muted-foreground">&rarr;</span>
          <span className="rounded-md bg-muted px-3 py-1">in_progress</span>
          <span className="text-muted-foreground">&rarr;</span>
          <span className="rounded-md bg-muted px-3 py-1">fixed</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Not every issue follows this exact path. Some may be closed as{" "}
          <span className="font-semibold text-foreground">wont_fix</span> or{" "}
          <span className="font-semibold text-foreground">duplicate</span>, and
          others may pause at{" "}
          <span className="font-semibold text-foreground">need_parts</span> or{" "}
          <span className="font-semibold text-foreground">need_help</span>{" "}
          before moving forward again.
        </p>
      </section>

      {/* Status Definitions */}
      <section className="space-y-3 mb-8">
        <h2 className="text-lg font-semibold">Status Definitions</h2>
        <div className="grid gap-6 md:grid-cols-2 text-sm text-muted-foreground">
          {/* Open statuses */}
          <div className="space-y-3">
            <h3 className="font-semibold text-foreground">Open Statuses</h3>
            <dl className="space-y-3">
              <div>
                <dt className="font-semibold text-foreground">new</dt>
                <dd>Just reported, needs triage</dd>
              </div>
              <div>
                <dt className="font-semibold text-foreground">confirmed</dt>
                <dd>Verified by an operator as an actual issue</dd>
              </div>
              <div>
                <dt className="font-semibold text-foreground">in_progress</dt>
                <dd>A technician is actively working on the repair</dd>
              </div>
              <div>
                <dt className="font-semibold text-foreground">need_parts</dt>
                <dd>The repair is paused while waiting for new parts</dd>
              </div>
              <div>
                <dt className="font-semibold text-foreground">need_help</dt>
                <dd>
                  The issue has been escalated to an expert for assistance
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-foreground">wait_owner</dt>
                <dd>Pending a decision or action from the machine owner</dd>
              </div>
            </dl>
          </div>

          {/* Closed statuses */}
          <div className="space-y-3">
            <h3 className="font-semibold text-foreground">Closed Statuses</h3>
            <dl className="space-y-3">
              <div>
                <dt className="font-semibold text-foreground">fixed</dt>
                <dd>The issue has been successfully resolved</dd>
              </div>
              <div>
                <dt className="font-semibold text-foreground">wai</dt>
                <dd>Working As Intended; the reported behavior is normal</dd>
              </div>
              <div>
                <dt className="font-semibold text-foreground">wont_fix</dt>
                <dd>The issue cannot or will not be fixed</dd>
              </div>
              <div>
                <dt className="font-semibold text-foreground">no_repro</dt>
                <dd>The issue could not be reproduced by a technician</dd>
              </div>
              <div>
                <dt className="font-semibold text-foreground">duplicate</dt>
                <dd>This issue was already reported elsewhere</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {/* How Assignment Works */}
      <section className="space-y-3 mb-8">
        <h2 className="text-lg font-semibold">How Assignment Works</h2>
        <p className="text-sm text-muted-foreground">
          Technicians can self-assign issues they want to work on, or an admin
          can assign issues to a specific technician. When someone is working on
          your issue, you&apos;ll see their name on the issue detail page.
          Assignment helps the team avoid duplicating effort and makes it clear
          who&apos;s responsible for each repair.
        </p>
      </section>

      {/* Watching Issues & Machines */}
      <section className="space-y-3 mb-8">
        <h2 className="text-lg font-semibold">
          Watching Issues &amp; Machines
        </h2>
        <p className="text-sm text-muted-foreground">
          You can &quot;watch&quot; an issue or a machine to receive
          notifications when things change. Watching an issue means you&apos;ll
          be notified of status changes and new comments. Watching a machine
          means you&apos;ll hear about new issues filed against it and status
          updates on its existing issues.
        </p>
        <p className="text-sm text-muted-foreground">
          You automatically watch issues you create. To watch a machine, visit
          its page and use the watch button. You can manage your watched items
          from your{" "}
          <Link href="/settings" className="text-primary underline">
            settings
          </Link>
          .
        </p>
      </section>
    </PageShell>
  );
}
