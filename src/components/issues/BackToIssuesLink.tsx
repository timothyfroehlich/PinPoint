import type React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface BackToIssuesLinkProps {
  /** The href to navigate to, typically read from cookie on the server */
  href?: string;
}

export function BackToIssuesLink({
  href = "/issues",
}: BackToIssuesLinkProps): React.JSX.Element {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      Back to Issues
    </Link>
  );
}
