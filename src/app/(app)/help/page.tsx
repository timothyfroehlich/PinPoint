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
            Choose a <strong>severity</strong> (see below), then submit.
          </li>
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
            <span className="font-semibold">minor</span> – cosmetic or small
            issues that do not change how the game plays.
          </li>
          <li>
            <span className="font-semibold">playable</span> – the game plays,
            but something is clearly wrong (shots not registering, features
            disabled, audio glitches).
          </li>
          <li>
            <span className="font-semibold">unplayable</span> – the game should
            be treated as down (ball stuck, flippers dead, game will not start).
          </li>
        </ul>
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
            When the issue is resolved, the machine&apos;s status updates based
            on its remaining open issues.
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
