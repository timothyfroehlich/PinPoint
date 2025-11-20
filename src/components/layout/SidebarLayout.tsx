import React from "react";
import { cn } from "~/lib/utils";

interface SidebarLayoutProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  className?: string;
}

export function SidebarLayout({
  children,
  sidebar,
  className,
}: SidebarLayoutProps): React.JSX.Element {
  return (
    <div className={cn("container mx-auto px-4 py-6 max-w-7xl", className)}>
      <div className="flex flex-col lg:flex-row gap-8">
        <main className="flex-1 min-w-0">{children}</main>
        {sidebar && (
          <aside className="hidden w-80 shrink-0 flex-col gap-6 border-l border-border bg-muted/10 p-6 lg:flex">
            {sidebar}
          </aside>
        )}
      </div>
    </div>
  );
}
