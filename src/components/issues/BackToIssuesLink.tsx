import type React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "~/lib/utils";

interface BackToIssuesLinkProps {
  /** The href to navigate to, typically read from cookie on the server */
  href?: string;
  className?: string;
}

export function BackToIssuesLink({
  href = "/issues",
  className,
}: BackToIssuesLinkProps): React.JSX.Element {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground",
        className
      )}
    >
      <ArrowLeft className="size-4" />
      Back to Issues
    </Link>
  );
}
