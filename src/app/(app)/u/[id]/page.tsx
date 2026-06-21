import { notFound } from "next/navigation";
import type React from "react";
import { createClient } from "~/lib/supabase/server";
import {
  getProfileById,
  getProfileActivityCounts,
  getCappedOwnedMachines,
  getOpenIssueCountsByInitials,
} from "~/lib/profiles/queries";
import { ProfileEditor } from "./profile-editor";
import { ProfileHero } from "./profile-hero";
import { ProfileStatGrid } from "./profile-stat-grid";
import { OwnedMachines } from "./owned-machines";
import { ProfileActivityFeed } from "./profile-activity-feed";

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
  const openCounts = await getOpenIssueCountsByInitials(
    owned.machines.map((m) => m.initials)
  );
  const isOwn = user?.id === id;
  const memberSince = profile.createdAt.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });

  return (
    <div className="@container mx-auto w-full max-w-2xl space-y-6 p-4">
      <ProfileHero
        name={profile.name}
        pronouns={profile.pronouns}
        role={profile.role}
        avatarUrl={profile.avatarUrl}
        memberSince={memberSince}
        isOwn={isOwn}
        editHref={`/u/${id}?edit=1`}
      />

      {isOwn && edit ? (
        <ProfileEditor
          profileId={id}
          initial={{
            firstName: profile.firstName,
            lastName: profile.lastName,
            pronouns: profile.pronouns,
            bio: profile.bio,
            avatarUrl: profile.avatarUrl,
          }}
        />
      ) : (
        <>
          <ProfileStatGrid
            reported={counts.reported}
            comments={counts.comments}
            machinesOwned={owned.total}
            fixed={counts.fixed}
            collectionHref={`/c/owner/${id}`}
          />

          {profile.bio ? (
            <p className="rounded-xl border border-outline-variant bg-card p-4 whitespace-pre-line text-pretty">
              {profile.bio}
            </p>
          ) : null}

          <OwnedMachines
            machines={owned.machines}
            total={owned.total}
            hasMore={owned.hasMore}
            ownerId={id}
            openCounts={openCounts}
          />

          <ProfileActivityFeed userId={id} />
        </>
      )}
    </div>
  );
}
