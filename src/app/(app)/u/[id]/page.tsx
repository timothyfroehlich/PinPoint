import { notFound } from "next/navigation";
import Link from "next/link";
import type React from "react";
import { createClient } from "~/lib/supabase/server";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import {
  getProfileById,
  getProfileActivityCounts,
  getCappedOwnedMachines,
} from "~/lib/profiles/queries";
import { ProfileEditor } from "./profile-editor";

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  const { edit } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profile = await getProfileById(id);
  if (!profile) notFound();

  const [counts, owned] = await Promise.all([
    getProfileActivityCounts(id),
    getCappedOwnedMachines(id),
  ]);
  const isOwn = user?.id === id;
  const memberSince = profile.createdAt.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });

  return (
    <div className="mx-auto w-full max-w-2xl p-4">
      <header className="flex items-center gap-4">
        <Avatar className="size-16">
          {profile.avatarUrl ? (
            <AvatarImage src={profile.avatarUrl} alt="" />
          ) : null}
          <AvatarFallback>{profile.firstName.charAt(0)}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-xl font-bold">
            {profile.name}
            {profile.pronouns ? (
              <span className="text-muted-foreground ml-2 text-sm font-normal">
                ({profile.pronouns})
              </span>
            ) : null}
          </h1>
          <p className="text-muted-foreground text-sm">
            <span className="capitalize">{profile.role}</span> · member since{" "}
            {memberSince}
          </p>
        </div>
        {isOwn ? (
          <Link
            href={`/u/${id}?edit=1`}
            className="text-primary ml-auto text-sm hover:underline"
          >
            Edit profile
          </Link>
        ) : null}
      </header>

      {isOwn && edit ? (
        <div className="mt-6">
          <ProfileEditor
            initial={{
              firstName: profile.firstName,
              lastName: profile.lastName,
              pronouns: profile.pronouns,
              bio: profile.bio,
              avatarUrl: profile.avatarUrl,
            }}
          />
        </div>
      ) : (
        <>
          {profile.bio ? (
            <p className="mt-4 whitespace-pre-line">{profile.bio}</p>
          ) : null}

          <section className="mt-6">
            <h2 className="text-muted-foreground text-xs font-semibold uppercase">
              Activity
            </h2>
            <div className="mt-2 flex gap-6">
              <div>
                <strong>{counts.reported}</strong>{" "}
                <span className="text-muted-foreground text-sm">
                  issues reported
                </span>
              </div>
              <div>
                <strong>{counts.comments}</strong>{" "}
                <span className="text-muted-foreground text-sm">comments</span>
              </div>
            </div>
          </section>

          {owned.total > 0 ? (
            <section className="mt-6">
              <h2 className="text-muted-foreground text-xs font-semibold uppercase">
                Owned machines ({owned.total})
              </h2>
              <ul className="mt-2 space-y-1">
                {owned.machines.map((m) => (
                  <li key={m.id}>
                    <Link href={`/m/${m.initials}`} className="hover:underline">
                      {m.name}
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                href={`/c/owner/${id}`}
                className="text-primary mt-2 inline-block text-sm hover:underline"
              >
                {owned.hasMore
                  ? `View all ${owned.total} →`
                  : "View full collection →"}
              </Link>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
