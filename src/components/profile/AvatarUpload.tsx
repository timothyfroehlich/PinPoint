"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Loader2, Upload, Trash2 } from "lucide-react";
import { compressImage } from "~/lib/blob/compression";
import { validateImageFile } from "~/lib/blob/validation";
import {
  uploadAvatarAction,
  deleteAvatarAction,
} from "~/app/(app)/settings/avatar-actions";
import { toast } from "sonner";
import { BLOB_CONFIG } from "~/lib/blob/config";

interface AvatarUploadProps {
  currentAvatarUrl: string | null;
  userName: string;
}

export function AvatarUpload({
  currentAvatarUrl,
  userName,
}: AvatarUploadProps): React.JSX.Element {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compute initials for fallback
  const initials = userName
    .split(" ")
    .filter((n) => n.length > 0)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check avatar-specific size limit first so users see the correct 2MB message
    if (file.size > BLOB_CONFIG.AVATAR.MAX_FILE_SIZE_BYTES) {
      toast.error(
        `File too large. Maximum size is ${BLOB_CONFIG.AVATAR.MAX_FILE_SIZE_BYTES / 1024 / 1024}MB.`
      );
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    // Client-side validation (MIME type and file size only; dimensions checked server-side)
    const validation = validateImageFile(file);
    if (!validation.valid) {
      toast.error(validation.error ?? "Selected file is not a valid image.");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    setIsUploading(true);
    try {
      // Compress before upload
      const compressedFile = await compressImage(file, "avatar");

      // Upload via server action
      const formData = new FormData();
      formData.append("avatar", compressedFile);

      const result = await uploadAvatarAction(formData);

      if (result.ok) {
        toast.success("Avatar updated successfully.");
        router.refresh();
      } else {
        toast.error(`Upload failed: ${result.message}`);
      }
    } catch (error) {
      console.error("Avatar upload error:", error);
      toast.error("An unexpected error occurred during upload.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDelete = async (): Promise<void> => {
    setIsDeleting(true);
    try {
      const result = await deleteAvatarAction();

      if (result.ok) {
        toast.success("Avatar removed.");
        router.refresh();
      } else {
        toast.error(`Failed to remove avatar: ${result.message}`);
      }
    } catch (error) {
      console.error("Avatar delete error:", error);
      toast.error("An unexpected error occurred.");
    } finally {
      setIsDeleting(false);
    }
  };

  const isLoading = isUploading || isDeleting;

  return (
    <div className="flex items-center gap-6">
      <Avatar className="size-20 border border-border">
        {currentAvatarUrl ? (
          <AvatarImage src={currentAvatarUrl} alt={userName} />
        ) : null}
        <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={isLoading}
            onClick={() => fileInputRef.current?.click()}
          >
            {isUploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            Upload Photo
          </Button>

          {currentAvatarUrl ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 text-destructive hover:text-destructive"
              disabled={isLoading}
              onClick={handleDelete}
            >
              {isDeleting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Remove
            </Button>
          ) : null}
        </div>

        <p className="text-xs text-muted-foreground">
          JPG, PNG or WebP. Max{" "}
          {BLOB_CONFIG.AVATAR.MAX_FILE_SIZE_BYTES / 1024 / 1024}MB.
        </p>
      </div>

      <Input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileChange}
        data-testid="avatar-upload-input"
      />
    </div>
  );
}
