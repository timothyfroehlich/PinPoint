"use client";

import * as React from "react";
import { useActionState } from "react";
import { updateProfileAction, type UpdateProfileResult } from "./actions";
import {
  uploadAvatarAction,
  type UploadAvatarResult,
} from "~/server/actions/avatar";
import { Input } from "~/components/ui/input";

interface ProfileEditorProps {
  initial: {
    firstName: string;
    lastName: string;
    pronouns: string | null;
    bio: string | null;
    avatarUrl: string | null;
  };
}

export function ProfileEditor({
  initial,
}: ProfileEditorProps): React.JSX.Element {
  const [profileState, profileAction] = useActionState<
    UpdateProfileResult | undefined,
    FormData
  >(updateProfileAction, undefined);

  const [avatarState, avatarAction] = useActionState<
    UploadAvatarResult | undefined,
    FormData
  >((_prevState, formData) => uploadAvatarAction(formData), undefined);

  return (
    <div className="space-y-6">
      {/* Avatar upload — its own form, posts a File to the avatar action */}
      <form
        action={avatarAction}
        encType="multipart/form-data"
        className="space-y-2"
      >
        {avatarState && !avatarState.ok ? (
          <p role="alert" className="text-destructive text-sm">
            Could not upload avatar. Check the file and try again.
          </p>
        ) : null}
        <label htmlFor="avatar" className="text-sm font-medium">
          Avatar
        </label>
        <input
          id="avatar"
          name="avatar"
          type="file"
          accept="image/jpeg,image/png,image/webp"
        />
        <button
          type="submit"
          className="text-primary block text-sm hover:underline"
        >
          Upload
        </button>
      </form>

      {/* Text fields — progressive-enhancement form */}
      <form action={profileAction} className="space-y-3">
        {profileState && !profileState.ok ? (
          <p role="alert" className="text-destructive text-sm">
            Could not save. Check your input.
          </p>
        ) : null}
        <div>
          <label htmlFor="firstName" className="text-sm font-medium">
            First name
          </label>
          <Input
            id="firstName"
            name="firstName"
            defaultValue={initial.firstName}
            required
          />
        </div>
        <div>
          <label htmlFor="lastName" className="text-sm font-medium">
            Last name
          </label>
          <Input
            id="lastName"
            name="lastName"
            defaultValue={initial.lastName}
            required
          />
        </div>
        <div>
          <label htmlFor="pronouns" className="text-sm font-medium">
            Pronouns
          </label>
          <Input
            id="pronouns"
            name="pronouns"
            defaultValue={initial.pronouns ?? ""}
          />
        </div>
        <div>
          <label htmlFor="bio" className="text-sm font-medium">
            Bio
          </label>
          <textarea
            id="bio"
            name="bio"
            defaultValue={initial.bio ?? ""}
            maxLength={500}
            className="border-input w-full rounded-md border p-2"
            rows={3}
          />
        </div>
        <button
          type="submit"
          className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm"
        >
          Save
        </button>
      </form>
    </div>
  );
}
