"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useIssueLink } from "~/hooks/use-issue-link";

export function BackToIssuesLink() {
  const href = useIssueLink();

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
