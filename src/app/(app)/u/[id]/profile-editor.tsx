"use client";

import * as React from "react";
import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ImageIcon, Loader2 } from "lucide-react";
import { updateProfileAction, type UpdateProfileResult } from "./actions";
import { uploadAvatarAction } from "~/server/actions/avatar";
import { compressImage } from "~/lib/blob/compression";
import { validateImageFile } from "~/lib/blob/validation";
import { getUploadErrorMessage } from "~/components/images/upload-error-message";
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
  const router = useRouter();
  const [profileState, profileAction] = useActionState<
    UpdateProfileResult | undefined,
    FormData
  >(updateProfileAction, undefined);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(initial.avatarUrl);

  async function handleFileChange(
    e: React.ChangeEvent<HTMLInputElement>
  ): Promise<void> {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      toast.error(validation.error ?? "Selected file is not a valid image.");
      return;
    }

    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);
    setIsUploading(true);
    try {
      const compressed = await compressImage(file, "cropped");
      const formData = new FormData();
      formData.append("avatar", compressed);

      const result = await uploadAvatarAction(formData);
      if (result.ok) {
        setPreview(result.value.avatarUrl);
        toast.success("Avatar updated");
        router.refresh();
      } else {
        setPreview(initial.avatarUrl);
        toast.error(`Upload failed: ${result.message}`);
      }
    } catch (error) {
      setPreview(initial.avatarUrl);
      toast.error(getUploadErrorMessage(error));
    } finally {
      setIsUploading(false);
      URL.revokeObjectURL(localPreview);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-6">
      {/* Avatar upload — client-driven (validate → compress → upload), matching ImageUploadButton */}
      <div className="flex flex-col gap-4 rounded-xl border border-outline-variant bg-card p-4 @lg:flex-row @lg:items-center">
        <Avatar className="size-16 ring-2 ring-primary/25">
          {preview ? <AvatarImage src={preview} alt="" /> : null}
          <AvatarFallback className="bg-primary text-lg font-bold text-on-primary">
            {initial.firstName.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 space-y-2">
          <p className="text-sm font-medium">Profile photo</p>
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {isUploading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <ImageIcon className="size-4" aria-hidden="true" />
            )}
            {isUploading ? "Uploading…" : "Choose image"}
          </Button>
          <p className="text-xs text-muted-foreground">
            JPEG, PNG, or WebP, up to 10&nbsp;MB.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            aria-label="Profile photo"
            onChange={handleFileChange}
          />
        </div>
      </div>

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
