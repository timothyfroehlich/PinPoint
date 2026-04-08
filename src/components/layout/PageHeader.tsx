import type React from "react";
import { cn } from "~/lib/utils";

interface PageHeaderProps {
  title: string;
  titleAdornment?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  titleAdornment,
  actions,
  className,
}: PageHeaderProps): React.JSX.Element {
  return (
    <div className={cn("border-b border-outline-variant pb-2", className)}>
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          {titleAdornment}
        </div>
        {actions != null && (
          <div className="flex items-center gap-3">{actions}</div>
        )}
      </div>
    </div>
  );
}
