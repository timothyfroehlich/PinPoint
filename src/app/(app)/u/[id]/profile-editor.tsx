"use client";

import * as React from "react";
import { useActionState } from "react";
import Link from "next/link";
import { updateProfileAction, type UpdateProfileResult } from "./actions";
import { uploadAvatarFormAction } from "~/server/actions/avatar";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Button } from "~/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";

interface ProfileEditorProps {
  /** The profile owner's id — used to return to the read view on cancel. */
  profileId: string;
  initial: {
    firstName: string;
    lastName: string;
    pronouns: string | null;
    bio: string | null;
    avatarUrl: string | null;
  };
}

export function ProfileEditor({
  profileId,
  initial,
}: ProfileEditorProps): React.JSX.Element {
  const [profileState, profileAction] = useActionState<
    UpdateProfileResult | undefined,
    FormData
  >(updateProfileAction, undefined);

  return (
    <div className="space-y-6">
      {/* Avatar upload — its own form, posts a File to the avatar action */}
      <form
        action={uploadAvatarFormAction}
        encType="multipart/form-data"
        className="flex flex-col gap-4 rounded-xl border border-outline-variant bg-card p-4 @lg:flex-row @lg:items-center"
      >
        <Avatar className="size-16 ring-2 ring-primary/25">
          {initial.avatarUrl ? (
            <AvatarImage src={initial.avatarUrl} alt="" />
          ) : null}
          <AvatarFallback className="bg-primary text-lg font-bold text-on-primary">
            {initial.firstName.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 space-y-2">
          <label htmlFor="avatar" className="block text-sm font-medium">
            Profile photo
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              id="avatar"
              name="avatar"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="max-w-xs cursor-pointer"
            />
            <Button type="submit" size="sm" variant="secondary">
              Upload
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            JPEG, PNG, or WebP, up to 10&nbsp;MB.
          </p>
        </div>
      </form>

      {/* Text fields — progressive-enhancement form */}
      <form
        action={profileAction}
        className="space-y-4 rounded-xl border border-outline-variant bg-card p-4"
      >
        {profileState && !profileState.ok ? (
          <p role="alert" className="text-sm text-destructive">
            Could not save. Check your input.
          </p>
        ) : null}
        <div className="space-y-1.5">
          <label htmlFor="firstName" className="text-sm font-medium">
            First name
          </label>
          <Input
            id="firstName"
            name="firstName"
            defaultValue={initial.firstName}
            autoComplete="given-name"
            required
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="lastName" className="text-sm font-medium">
            Last name
          </label>
          <Input
            id="lastName"
            name="lastName"
            defaultValue={initial.lastName}
            autoComplete="family-name"
            required
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="pronouns" className="text-sm font-medium">
            Pronouns
          </label>
          <Input
            id="pronouns"
            name="pronouns"
            defaultValue={initial.pronouns ?? ""}
            placeholder="they/them"
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="bio" className="text-sm font-medium">
            Bio
          </label>
          <Textarea
            id="bio"
            name="bio"
            defaultValue={initial.bio ?? ""}
            maxLength={500}
            rows={3}
          />
        </div>
        <div className="flex items-center gap-3 pt-1">
          <Button type="submit">Save</Button>
          <Button asChild variant="outline">
            <Link href={`/u/${profileId}`}>Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
