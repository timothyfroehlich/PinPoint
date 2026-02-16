import type React from "react";
import Link from "next/link";

import { PageShell } from "~/components/layout/PageShell";

export const metadata = {
  title: "Reporting Issues | PinPoint",
};

export default function ReportingPage(): React.JSX.Element {
  return (
    <PageShell size="narrow">
      <header className="space-y-2 mb-8">
        <p className="text-sm text-muted-foreground">
          <Link href="/help" className="text-link">
            Help
          </Link>{" "}
          / Reporting Issues
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Reporting Issues
        </h1>
        <p className="text-sm text-muted-foreground">
          How to file a clear, useful issue report so technicians can find and
          fix the problem quickly.
        </p>
      </header>

      {/* How to Report an Issue */}
      <section className="space-y-3 mb-8">
        <h2 className="text-lg font-semibold">How to Report an Issue</h2>
        <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
          <li>
            Go to the{" "}
            <Link href="/report" className="text-primary underline">
              Report Issue
            </Link>{" "}
            page
          </li>
          <li>Select the machine you are standing at</li>
          <li>Give the issue a short, clear title</li>
          <li>Describe what you saw — what happened, which shot, which coil</li>
          <li>
            Choose a severity (how it affects play) and frequency (how often it
            happens)
          </li>
          <li>
            (Optional) Provide your name and email if you want to be notified
            about the fix
          </li>
          <li>Submit the report</li>
        </ol>
      </section>

      {/* Severity Levels */}
      <section className="space-y-3 mb-8">
        <h2 className="text-lg font-semibold">Severity Levels</h2>
        <p className="text-sm text-muted-foreground">
          Severity describes how much the issue affects gameplay:
        </p>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>
            <span className="font-semibold text-foreground">Cosmetic</span> —
            very minor issues that do not affect gameplay at all (dirty
            playfield, minor bulb out)
          </li>
          <li>
            <span className="font-semibold text-foreground">Minor</span> — small
            issues that do not change how the game plays, but might be
            noticeable
          </li>
          <li>
            <span className="font-semibold text-foreground">Major</span> — the
            game plays, but something significant is wrong (shots not
            registering, features disabled, audio glitches)
          </li>
          <li>
            <span className="font-semibold text-foreground">Unplayable</span> —
            the game should be treated as down (ball stuck, flippers dead, game
            will not start)
          </li>
        </ul>
      </section>

      {/* Frequency */}
      <section className="space-y-3 mb-8">
        <h2 className="text-lg font-semibold">Frequency</h2>
        <p className="text-sm text-muted-foreground">
          Frequency describes how often the problem happens:
        </p>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>
            <span className="font-semibold text-foreground">Intermittent</span>{" "}
            — happens sometimes, but not every time (e.g., a ball occasionally
            gets stuck)
          </li>
          <li>
            <span className="font-semibold text-foreground">Frequent</span> —
            happens often during a game
          </li>
          <li>
            <span className="font-semibold text-foreground">Constant</span> —
            happens every single time the shot or feature is triggered (e.g., a
            flipper is completely dead)
          </li>
        </ul>
      </section>

      {/* Tips for a Good Report */}
      <section className="space-y-3 mb-8">
        <h2 className="text-lg font-semibold">Tips for a Good Report</h2>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>
            Use a specific title (
            <span className="font-semibold text-foreground">
              &quot;Left flipper dead on Medieval Madness&quot;
            </span>{" "}
            not{" "}
            <span className="font-semibold text-foreground">
              &quot;broken&quot;
            </span>
            )
          </li>
          <li>Say which shot or feature is affected</li>
          <li>Note if the problem just started or has been ongoing</li>
          <li>
            Add photos if you can — they help techs understand the problem
            faster
          </li>
        </ul>
      </section>

      {/* What Happens After You Report */}
      <section className="space-y-3 mb-8">
        <h2 className="text-lg font-semibold">What Happens After You Report</h2>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>The issue appears on the dashboard for members and operators</li>
          <li>
            A tech can assign the issue to themselves or another member and
            update its status as they work
          </li>
          <li>
            Comments can be added to track troubleshooting steps and fixes
          </li>
          <li>
            When the issue is fixed, the machine&apos;s status updates based on
            its remaining open issues
          </li>
        </ul>
      </section>
    </PageShell>
  );
}
