"use client";

import type React from "react";
import Link from "next/link";
import {
  HelpCircle,
  MessageSquare,
  Sparkles,
  Info,
  Palette,
  MonitorSmartphone,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { openFeedbackForm } from "~/components/feedback/FeedbackWidget";

interface HelpMenuProps {
  newChangelogCount: number;
}

/**
 * Help/Info dropdown menu for the AppHeader.
 *
 * Contains: Feedback (Sentry widget), What's New (with badge), Help, About.
 * Badge dot appears on the trigger icon when newChangelogCount > 0.
 */
export function HelpMenu({
  newChangelogCount,
}: HelpMenuProps): React.JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground hover:text-primary"
          aria-label="Help and info"
          data-testid="help-menu-trigger"
        >
          <HelpCircle className="size-5" />
          {newChangelogCount > 0 && (
            <span
              className="absolute top-1 right-1 size-2 rounded-full bg-primary"
              aria-hidden="true"
              data-testid="help-menu-badge"
            />
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-48 bg-surface-variant">
        <DropdownMenuItem
          onSelect={() => {
            openFeedbackForm();
          }}
          className="cursor-pointer"
          data-testid="help-menu-feedback"
        >
          <MessageSquare className="mr-2 size-4" />
          <span>Feedback</span>
        </DropdownMenuItem>

        <DropdownMenuItem asChild className="cursor-pointer">
          <Link
            href="/whats-new"
            className="flex w-full items-center"
            data-testid="help-menu-whats-new"
          >
            <Sparkles className="mr-2 size-4" />
            <span>What&apos;s New</span>
            {newChangelogCount > 0 && (
              <span className="ml-auto text-xs font-medium text-primary">
                {newChangelogCount > 20 ? "20+" : newChangelogCount}
              </span>
            )}
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild className="cursor-pointer">
          <Link
            href="/help"
            className="flex w-full items-center"
            data-testid="help-menu-help"
          >
            <HelpCircle className="mr-2 size-4" />
            <span>Help</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild className="cursor-pointer">
          <Link
            href="/about"
            className="flex w-full items-center"
            data-testid="help-menu-about"
          >
            <Info className="mr-2 size-4" />
            <span>About</span>
          </Link>
        </DropdownMenuItem>
        {process.env.NODE_ENV === "development" && (
          <>
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link
                href="/dev/design-system"
                className="flex w-full items-center"
                data-testid="help-menu-design-system"
              >
                <Palette className="mr-2 size-4" />
                <span>Design System</span>
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem asChild className="cursor-pointer">
              <Link
                href="/dev/preview"
                className="flex w-full items-center"
                data-testid="help-menu-preview"
              >
                <MonitorSmartphone className="mr-2 size-4" />
                <span>Preview</span>
              </Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
