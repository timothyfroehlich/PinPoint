import type React from "react";
import Link from "next/link";

import { PageShell } from "~/components/layout/PageShell";

export const metadata = {
  title: "Getting Started | PinPoint",
};

export default function GettingStartedPage(): React.JSX.Element {
  return (
    <PageShell size="narrow">
      <header className="space-y-2 mb-8">
        <p className="text-sm text-muted-foreground">
          <Link href="/help" className="text-link">
            Help
          </Link>{" "}
          / Getting Started
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Getting Started
        </h1>
        <p className="text-sm text-muted-foreground">
          Everything you need to know to start using PinPoint in a few minutes.
        </p>
      </header>

      {/* What is PinPoint? */}
      <section className="space-y-3 mb-8">
        <h2 className="text-lg font-semibold">What is PinPoint?</h2>
        <p className="text-sm text-muted-foreground">
          PinPoint is the issue tracker for{" "}
          <span className="font-semibold text-foreground">
            Austin Pinball Collective
          </span>
          . Report broken machines, track repairs, and see which games are
          playable — all in one place. Whether you&apos;re a regular player or
          just visiting, PinPoint helps keep the machines in great shape.
        </p>
      </section>

      {/* Quick Tour */}
      <section className="space-y-3 mb-8">
        <h2 className="text-lg font-semibold">Quick Tour</h2>
        <p className="text-sm text-muted-foreground">
          Here are the main sections you&apos;ll use:
        </p>
        <dl className="space-y-4 text-sm">
          <div>
            <dt className="font-semibold text-foreground">Dashboard</dt>
            <dd className="text-muted-foreground">
              A snapshot of machine health and recent issues across the
              collection. Start here to see what&apos;s happening.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Machines</dt>
            <dd className="text-muted-foreground">
              Browse every machine in the collection. Each page shows its
              current status, open issues, and repair history.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Issues</dt>
            <dd className="text-muted-foreground">
              See all reported problems and their progress — from newly filed to
              resolved. Filter by status, machine, or priority.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Report</dt>
            <dd className="text-muted-foreground">
              File a new issue when something&apos;s wrong.{" "}
              <Link href="/report" className="text-primary underline">
                Open the report form
              </Link>{" "}
              to get started.
            </dd>
          </div>
        </dl>
      </section>

      {/* Your First Report */}
      <section className="space-y-3 mb-8">
        <h2 className="text-lg font-semibold">Your First Report</h2>
        <p className="text-sm text-muted-foreground">
          See a broken flipper or a stuck ball? Report it so our technicians can
          fix it. Pick the machine, describe the problem, and submit — it only
          takes a minute. Your report helps the team prioritize repairs and keep
          games playable for everyone.
        </p>
        <p className="text-sm">
          <Link href="/help/reporting" className="text-primary underline">
            Read the full reporting guide
          </Link>
        </p>
      </section>

      {/* Accounts & Roles */}
      <section className="space-y-3 mb-8">
        <h2 className="text-lg font-semibold">Accounts &amp; Roles</h2>
        <p className="text-sm text-muted-foreground">
          You can report issues without an account — just use the report form as
          a guest. If you sign up, you&apos;ll be able to track your reports,
          receive notifications when issues are updated, and watch specific
          machines for new problems.
        </p>
        <p className="text-sm text-muted-foreground">
          PinPoint has several roles —{" "}
          <span className="font-semibold text-foreground">Guest</span>,{" "}
          <span className="font-semibold text-foreground">Member</span>,{" "}
          <span className="font-semibold text-foreground">Technician</span>, and{" "}
          <span className="font-semibold text-foreground">Admin</span> — each
          with different permissions.
        </p>
        <p className="text-sm">
          <Link href="/help/permissions" className="text-primary underline">
            See the full roles &amp; permissions breakdown
          </Link>
        </p>
      </section>
    </PageShell>
  );
}
