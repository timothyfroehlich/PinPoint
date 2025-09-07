"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
// import { Menu } from "lucide-react";

export function MobileNavToggle(): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="md:hidden">
          {/* <Menu className="h-5 w-5" /> */}
          <span className="text-lg">☰</span>
          <span className="sr-only">Toggle navigation menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <div className="flex flex-col h-full">
          <SheetHeader className="p-4 border-b">
            <SheetTitle className="text-left">Navigation</SheetTitle>
          </SheetHeader>
          <div className="flex-1 p-4">
            {/* Navigation items would be rendered here */}
            <div className="space-y-2">
              <Button variant="ghost" className="w-full justify-start" asChild>
                <a href="/dashboard">Dashboard</a>
              </Button>
              <Button variant="ghost" className="w-full justify-start" asChild>
                <Link href="/issues">Issues</Link>
              </Button>
              <Button variant="ghost" className="w-full justify-start" asChild>
                <Link href="/machines">Machines</Link>
              </Button>
              <Button variant="ghost" className="w-full justify-start" asChild>
                <Link href="/locations">Locations</Link>
              </Button>
              <Button variant="ghost" className="w-full justify-start" asChild>
                <a href="/reports">Reports</a>
              </Button>
              <Button variant="ghost" className="w-full justify-start" asChild>
                <a href="/settings">Settings</a>
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
