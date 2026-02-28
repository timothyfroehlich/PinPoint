import type React from "react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About | PinPoint",
  description:
    "About PinPoint - A pinball machine issue tracker for Austin Pinball Collective",
};

export default function AboutPage(): React.JSX.Element {
  return (
    <div className="max-w-3xl mx-auto py-10">
      <header className="space-y-2 mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          About PinPoint
        </h1>
        <p className="text-sm text-muted-foreground">
          Keeping machines playable at Austin Pinball Collective.
        </p>
      </header>

      <section className="space-y-3 mb-8">
        <h2 className="text-lg font-semibold">What is PinPoint?</h2>
        <p className="text-sm text-muted-foreground">
          PinPoint is a pinball machine issue tracker built for{" "}
          <a
            href="https://austinpinballcollective.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            Austin Pinball Collective
          </a>
          . It helps players report problems they encounter on machines and
          gives the team a clear view of what needs attention.
        </p>
        <p className="text-sm text-muted-foreground">
          Whether a flipper is stuck, a bumper is misfiring, or a game will not
          start, PinPoint makes it easy to log the issue and track it through
          resolution.
        </p>
      </section>

      <section className="space-y-3 mb-8">
        <h2 className="text-lg font-semibold">How It Works</h2>
        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
          <li>Players report issues from any device, no account required.</li>
          <li>
            Members and admins triage, assign, and resolve issues on an internal
            dashboard.
          </li>
          <li>
            Machine health updates automatically as issues are opened and
            closed.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Legal</h2>
        <ul className="space-y-1 text-sm">
          <li>
            <Link href="/privacy" className="text-primary underline">
              Privacy Policy
            </Link>
          </li>
          <li>
            <Link href="/terms" className="text-primary underline">
              Terms of Service
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
