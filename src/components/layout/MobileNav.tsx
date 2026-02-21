"use client";

import type React from "react";
import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Sidebar } from "~/components/layout/Sidebar";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetDescription,
} from "~/components/ui/sheet";

export function MobileNav({
  role,
  issuesPath,
  newChangelogCount = 0,
}: {
  role?: "guest" | "member" | "technician" | "admin" | undefined;
  issuesPath?: string;
  newChangelogCount?: number;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Open menu"
          data-testid="mobile-menu-trigger"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="p-0 w-72">
        <div className="sr-only">
          <SheetTitle>Navigation Menu</SheetTitle>
          <SheetDescription>
            Main navigation menu for accessing dashboard, issues, and machines.
          </SheetDescription>
        </div>
        <Sidebar
          role={role}
          onNavigate={() => setOpen(false)}
          isMobile={true}
          issuesPath={issuesPath}
          newChangelogCount={newChangelogCount}
        />
      </SheetContent>
    </Sheet>
  );
}
