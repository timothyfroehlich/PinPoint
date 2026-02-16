import type React from "react";
import Link from "next/link";

import { PageShell } from "~/components/layout/PageShell";

interface HelpPageProps {
  breadcrumb: string;
  title: string;
  description?: string;
  size?: "narrow" | "default";
  children: React.ReactNode;
}

export function HelpPage({
  breadcrumb,
  title,
  description,
  size = "narrow",
  children,
}: HelpPageProps): React.JSX.Element {
  return (
    <PageShell size={size}>
      <header className="space-y-2 mb-8">
        <p className="text-sm text-muted-foreground">
          <Link href="/help" className="text-link">
            Help
          </Link>
          {" / "}
          {breadcrumb}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </header>
      {children}
    </PageShell>
  );
}
