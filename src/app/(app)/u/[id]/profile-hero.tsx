import type React from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";

interface ProfileHeroProps {
  name: string;
  pronouns: string | null;
  role: "guest" | "member" | "technician" | "admin";
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
    <header className="relative overflow-hidden rounded-2xl border border-outline-variant bg-card bg-[radial-gradient(120%_140%_at_0%_0%,color-mix(in_srgb,var(--color-primary)_14%,transparent),transparent_55%),radial-gradient(120%_140%_at_100%_0%,color-mix(in_srgb,var(--color-secondary)_12%,transparent),transparent_55%)] p-6">
      <div className="flex flex-col gap-4 @lg:flex-row @lg:items-center">
        <Avatar className="size-20">
          {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
          <AvatarFallback className="text-2xl">{name.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-balance">
            {name}
            {pronouns ? (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {pronouns}
              </span>
            ) : null}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center rounded-full bg-primary-container px-2.5 py-0.5 text-xs font-semibold capitalize text-primary">
              {role}
            </span>
            <span className="text-sm text-muted-foreground">
              member since {memberSince}
            </span>
          </div>
        </div>
        {isOwn ? (
          <Link
            href={editHref}
            className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-md border border-primary/45 px-3 py-1.5 text-sm font-semibold text-primary transition-colors duration-150 hover:bg-primary/10 @lg:self-auto"
          >
            <Pencil className="size-4" aria-hidden="true" />
            Edit profile
          </Link>
        ) : null}
      </div>
    </header>
  );
}
