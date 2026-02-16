import type React from "react";
import Link from "next/link";

import { PageShell } from "~/components/layout/PageShell";

export const metadata = {
  title: "Contact & Support | PinPoint",
};

export default function SupportPage(): React.JSX.Element {
  return (
    <PageShell size="narrow">
      <header className="space-y-2 mb-8">
        <p className="text-sm text-muted-foreground">
          <Link href="/help" className="text-link">
            Help
          </Link>{" "}
          / Contact &amp; Support
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Contact &amp; Support
        </h1>
      </header>

      <section className="space-y-3 mb-8">
        <h2 className="text-lg font-semibold">Austin Pinball Collective</h2>
        <p className="text-sm text-muted-foreground">
          PinPoint is built for Austin Pinball Collective (APC). If you have
          questions about machines, events, or membership, reach out to an
          organizer at the venue.
        </p>
      </section>

      <section className="space-y-3 mb-8">
        <h2 className="text-lg font-semibold">PinPoint Feedback</h2>
        <p className="text-sm text-muted-foreground">
          Found a bug in PinPoint itself, or have a feature suggestion? Use the
          feedback button in the bottom-right corner of any page to let us know.
          Your feedback goes directly to the development team.
        </p>
      </section>

      <section className="space-y-3 mb-8">
        <h2 className="text-lg font-semibold">Something Looks Wrong?</h2>
        <p className="text-sm text-muted-foreground">
          If you see a missing machine, duplicate issues, or something that
          doesn&apos;t match reality, talk to an Austin Pinball Collective
          organizer or a trusted operator. They can correct machine data, merge
          or close issues, or adjust severities as needed.
        </p>
      </section>
    </PageShell>
  );
}
