import type React from "react";
import Link from "next/link";

import { PageShell } from "~/components/layout/PageShell";
import { FaqAccordion } from "./faq-accordion";

export const metadata = {
  title: "FAQ | PinPoint",
};

export default function FaqPage(): React.JSX.Element {
  return (
    <PageShell size="narrow">
      <header className="space-y-2 mb-8">
        <p className="text-sm text-muted-foreground">
          <Link href="/help" className="text-link">
            Help
          </Link>{" "}
          / FAQ
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Frequently Asked Questions
        </h1>
        <p className="text-sm text-muted-foreground">
          Quick answers to common questions about using PinPoint.
        </p>
      </header>

      <FaqAccordion />
    </PageShell>
  );
}
