import type React from "react";
import Link from "next/link";
import { PageShell } from "~/components/layout/PageShell";

export const metadata = {
  title: "Help | PinPoint",
};

export default function HelpPage(): React.JSX.Element {
  return (
    <PageShell size="narrow">
      <header className="space-y-2 mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Help</h1>
        <p className="text-sm text-muted-foreground">
          How to use PinPoint to report issues, understand severity, and keep
          machines playable at Austin Pinball Collective.
        </p>
      </header>

      <section className="space-y-3 mb-8">
        <h2 className="text-lg font-semibold">Reporting an Issue</h2>
        <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
          <li>
            Go to the{" "}
            <Link href="/report" className="text-primary underline">
              Report Issue
            </Link>{" "}
            page.
          </li>
          <li>Select the machine you are standing at.</li>
          <li>Give the issue a short, clear title.</li>
          <li>
            Describe what you saw (what happened, which shot, which coil).
          </li>
          <li>
            Choose a <strong>severity</strong> (how it affects play) and{" "}
            <strong>frequency</strong> (how often it happens).
          </li>
          <li>
            (Optional) Provide your name and email if you want to be notified
            about the fix.
          </li>
          <li>Submit the report.</li>
        </ol>
      </section>

      <section className="space-y-3 mb-8">
        <h2 className="text-lg font-semibold">Severity Levels</h2>
        <p className="text-sm text-muted-foreground">
          Severities are player-centric: think about what a player experiences
          when they walk up to the machine.
        </p>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>
            <span className="font-semibold text-foreground">cosmetic</span> –
            very minor issues that do not affect gameplay at all (dirty
            playfield, minor bulb out).
          </li>
          <li>
            <span className="font-semibold text-foreground">minor</span> – small
            issues that do not change how the game plays, but might be
            noticeable.
          </li>
          <li>
            <span className="font-semibold text-foreground">major</span> – the
            game plays, but something significant is wrong (shots not
            registering, features disabled, audio glitches).
          </li>
          <li>
            <span className="font-semibold text-foreground">unplayable</span> –
            the game should be treated as down (ball stuck, flippers dead, game
            will not start).
          </li>
        </ul>
      </section>

      <section className="space-y-3 mb-8">
        <h2 className="text-lg font-semibold">Frequency</h2>
        <p className="text-sm text-muted-foreground">
          Helping us understand how often a problem occurs makes it much easier
          for our technicians to reproduce and fix it.
        </p>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>
            <span className="font-semibold text-foreground">intermittent</span>{" "}
            – The issue happens sometimes, but not every time (e.g., a ball
            occasionally gets stuck).
          </li>
          <li>
            <span className="font-semibold text-foreground">frequent</span> –
            The issue happens often during a game.
          </li>
          <li>
            <span className="font-semibold text-foreground">constant</span> –
            The issue happens every single time the shot or feature is triggered
            (e.g., a flipper is completely dead).
          </li>
        </ul>
      </section>

      <section className="space-y-3 mb-8">
        <h2 className="text-lg font-semibold">Issue Statuses</h2>
        <p className="text-sm text-muted-foreground">
          As an issue moves through its lifecycle, its status will be updated to
          reflect its current state.
        </p>
        <div className="grid gap-6 md:grid-cols-2 text-sm text-muted-foreground">
          <div className="space-y-2">
            <h3 className="font-medium text-foreground">Open</h3>
            <ul className="space-y-2">
              <li>
                <span className="font-semibold text-foreground">new</span> –
                Just reported, needs triage.
              </li>
              <li>
                <span className="font-semibold text-foreground">confirmed</span>{" "}
                – Verified by an operator as an actual issue.
              </li>
              <li>
                <span className="font-semibold text-foreground">
                  in_progress
                </span>{" "}
                – A technician is actively working on the repair.
              </li>
              <li>
                <span className="font-semibold text-foreground">
                  need_parts
                </span>{" "}
                – The repair is paused while waiting for new parts.
              </li>
              <li>
                <span className="font-semibold text-foreground">need_help</span>{" "}
                – The issue has been escalated to an expert for assistance.
              </li>
              <li>
                <span className="font-semibold text-foreground">
                  wait_owner
                </span>{" "}
                – Pending a decision or action from the machine owner.
              </li>
            </ul>
          </div>
          <div className="space-y-2">
            <h3 className="font-medium text-foreground">Closed</h3>
            <ul className="space-y-2">
              <li>
                <span className="font-semibold text-foreground">fixed</span> –
                The issue has been successfully resolved.
              </li>
              <li>
                <span className="font-semibold text-foreground">wai</span> –
                Working As Intended; the reported behavior is normal.
              </li>
              <li>
                <span className="font-semibold text-foreground">wont_fix</span>{" "}
                – The issue cannot or will not be fixed.
              </li>
              <li>
                <span className="font-semibold text-foreground">no_repro</span>{" "}
                – The issue could not be reproduced by a technician.
              </li>
              <li>
                <span className="font-semibold text-foreground">duplicate</span>{" "}
                – This issue was already reported elsewhere.
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="space-y-3 mb-8">
        <h2 className="text-lg font-semibold">What Happens After You Report</h2>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>
            The issue appears on the internal dashboard for members and
            operators.
          </li>
          <li>
            A tech can assign the issue to themselves or another member and
            update its status as they work.
          </li>
          <li>
            Comments can be added to track troubleshooting steps and fixes.
          </li>
          <li>
            When the issue is <strong>fixed</strong>, the machine&apos;s status
            updates based on its remaining open issues.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">If Something Looks Wrong</h2>
        <p className="text-sm text-muted-foreground">
          If you see a missing machine, duplicate issues, or something that
          doesn&apos;t match reality, talk to an Austin Pinball Collective
          organizer or a trusted operator. They can correct machine data,
          merge/close issues, or adjust severities as needed.
        </p>
      </section>
    </PageShell>
  );
}
