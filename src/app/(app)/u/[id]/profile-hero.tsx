import type React from "react";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import type { UserRole } from "~/lib/types";
import { ProfileActions } from "./profile-actions";

interface ProfileHeroProps {
  name: string;
  pronouns: string | null;
  role: UserRole;
  avatarUrl: string | null;
  memberSince: string;
  isOwn: boolean;
  editHref: string;
}

export function ProfileHero({
  name,
  pronouns,
  role,
  avatarUrl,
  memberSince,
  isOwn,
  editHref,
}: ProfileHeroProps): React.JSX.Element {
  return (
    <header
      data-testid="profile-hero"
      className="profile-hero-surface relative overflow-hidden rounded-2xl border border-outline-variant bg-card p-6"
    >
      <div className="flex flex-col gap-4 @lg:flex-row @lg:items-center">
        <Avatar className="size-20 ring-2 ring-primary/25">
          {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
          <AvatarFallback className="bg-primary text-2xl font-bold text-on-primary">
            {name.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold tracking-tight text-balance @lg:text-3xl">
            {name}
            {pronouns ? (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {pronouns}
              </span>
            ) : null}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/35 bg-primary-container px-2.5 py-0.5 text-xs font-semibold capitalize text-primary">
              <span
                className="size-1.5 rounded-full bg-primary"
                aria-hidden="true"
              />
              {role}
            </span>
            <span className="text-sm text-muted-foreground">
              member since {memberSince}
            </span>
          </div>
        </div>
        {isOwn ? (
          // Its own row below the name on narrow cards, the end of the row
          // on wide ones; either way it has room to measure (design-bible §26).
          <ProfileActions
            editHref={editHref}
            className="w-full justify-start @lg:w-auto @lg:max-w-48 @lg:justify-end"
          />
        ) : null}
      </div>
    </header>
  );
}
