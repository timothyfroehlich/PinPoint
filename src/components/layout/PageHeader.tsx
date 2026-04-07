import type React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

interface PageHeaderProps {
  title: string;
  backHref?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  backHref,
  actions,
  className,
}: PageHeaderProps): React.JSX.Element {
  return (
    <div
      className={cn(
        "flex items-center justify-between border-b border-outline-variant pb-6",
        className
      )}
    >
      {backHref ? (
        <div className="flex items-center gap-4">
          <Link href={backHref}>
            <Button
              variant="outline"
              size="sm"
              className="border-outline text-on-surface hover:bg-surface-variant"
            >
              <ArrowLeft className="mr-2 size-4" />
              Back
            </Button>
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        </div>
      ) : (
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      )}
      {actions !== undefined && <div>{actions}</div>}
    </div>
  );
}
