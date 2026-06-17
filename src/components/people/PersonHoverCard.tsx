"use client";

import * as React from "react";
import Link from "next/link";
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "~/components/ui/hover-card";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PersonCardPayload {
  name: string;
  avatarUrl: string | null;
  pronouns: string | null;
  role: string;
  machineCount: number;
}

export interface PersonHoverCardProps {
  userId: string | null;
  invitedId?: string | null;
  displayName: string;
  className?: string;
}

// ---------------------------------------------------------------------------
// Inner component — rendered only when userId is a non-null string.
// ALL hooks live here; no conditional hook calls.
// ---------------------------------------------------------------------------

interface PersonHoverCardLinkProps {
  userId: string;
  displayName: string;
  className?: string | undefined;
}

function PersonHoverCardLink({
  userId,
  displayName,
  className,
}: PersonHoverCardLinkProps): React.JSX.Element {
  const [data, setData] = React.useState<PersonCardPayload | null>(null);
  const [loading, setLoading] = React.useState(false);

  function loadOnce(): void {
    if (data !== null || loading) return;
    setLoading(true);
    fetch(`/api/users/${userId}/card`)
      .then((r) => (r.ok ? (r.json() as Promise<PersonCardPayload>) : null))
      .then((payload) => setData(payload))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }

  return (
    <HoverCard
      onOpenChange={(open) => {
        if (open) loadOnce();
      }}
    >
      <HoverCardTrigger asChild>
        {/* CORE-A11Y: real Link so keyboard / touch reach the profile page
            without the hover card. */}
        <Link href={`/u/${userId}`} className={className}>
          {displayName}
        </Link>
      </HoverCardTrigger>
      <HoverCardContent>
        <div className="flex items-center gap-3">
          <Avatar className="size-10">
            {data?.avatarUrl ? (
              <AvatarImage src={data.avatarUrl} alt="" />
            ) : null}
            <AvatarFallback>{displayName.charAt(0)}</AvatarFallback>
          </Avatar>
          <div>
            <div className="font-semibold">
              {data?.name ?? displayName}
              {data?.pronouns ? (
                <span className="text-muted-foreground ml-1 text-xs font-normal">
                  ({data.pronouns})
                </span>
              ) : null}
            </div>
            {data ? (
              <div className="text-muted-foreground text-xs capitalize">
                {data.role}
              </div>
            ) : null}
          </div>
        </div>
        {data !== null && data.machineCount > 0 ? (
          <Link
            href={`/c/owner/${userId}`}
            className="text-muted-foreground mt-2 block text-xs hover:underline"
          >
            Owns {data.machineCount} machine
            {data.machineCount === 1 ? "" : "s"}
          </Link>
        ) : null}
        <Link
          href={`/u/${userId}`}
          className="text-primary mt-2 block text-sm hover:underline"
        >
          View profile →
        </Link>
      </HoverCardContent>
    </HoverCard>
  );
}

// ---------------------------------------------------------------------------
// Public dispatcher
//
// Early-returns a bare <span> for invited / former users before any hook
// could be called.  Rules of Hooks are satisfied: no hook is called in this
// component at all — every hook lives in PersonHoverCardLink above.
// ---------------------------------------------------------------------------

export function PersonHoverCard({
  userId,
  displayName,
  className,
}: PersonHoverCardProps): React.JSX.Element {
  // Invited or former users have no profile page — render plain text, no card.
  if (!userId) {
    return <span className={className}>{displayName}</span>;
  }

  return (
    <PersonHoverCardLink
      userId={userId}
      displayName={displayName}
      className={className}
    />
  );
}
