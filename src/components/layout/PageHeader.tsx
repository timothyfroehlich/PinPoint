import type React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "~/lib/utils";

interface BreadcrumbItem {
  label: string;
  href: string;
}

interface PageHeaderProps {
  title: string;
  breadcrumbs?: BreadcrumbItem[];
  titleAdornment?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  breadcrumbs,
  titleAdornment,
  actions,
  className,
}: PageHeaderProps): React.JSX.Element {
  return (
    <div className={cn("border-b border-outline-variant pb-6", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="mb-3 flex items-center gap-1.5 text-sm text-muted-foreground">
          {breadcrumbs.map((crumb, i) => (
            <span key={crumb.href} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight className="size-3.5" />}
              <Link
                href={crumb.href}
                className="transition-colors hover:text-foreground"
              >
                {crumb.label}
              </Link>
            </span>
          ))}
        </nav>
      )}
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {titleAdornment}
        </div>
        {actions !== undefined && (
          <div className="flex items-center gap-3">{actions}</div>
        )}
      </div>
    </div>
  );
}
