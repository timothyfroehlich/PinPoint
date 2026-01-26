"use client";

import React, { useState, useRef } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Camera, Image as ImageIcon, Loader2 } from "lucide-react";
import { compressImage } from "~/lib/blob/compression";
import { validateImageFile } from "~/lib/blob/validation";
import { uploadIssueImage } from "~/server/actions/images";
import { toast } from "~/components/ui/use-toast";

interface ImageMetadata {
  blobUrl: string;
  blobPathname: string;
  originalFilename: string;
  fileSizeBytes: number;
  mimeType: string;
  imageId?: string;
}

interface ImageUploadButtonProps {
  issueId: string; // 'new' or UUID
  onUploadComplete?: (imageData: ImageMetadata) => void;
  disabled?: boolean;
  currentCount: number;
  maxCount: number;
}

export function ImageUploadButton({
  issueId,
  onUploadComplete,
  disabled,
  currentCount,
  maxCount,
}: ImageUploadButtonProps): React.JSX.Element {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log("[ImageUpload] Step 1: File selected", {
      name: file.name,
      size: file.size,
      type: file.type,
    });

    // 1. Validate
    const validation = validateImageFile(file);
    if (!validation.valid) {
      console.log("[ImageUpload] Validation failed:", validation.error);
      toast({
        variant: "destructive",
        title: "Invalid image",
        description: validation.error ?? "Selected file is not a valid image.",
      });
      return;
    }

    console.log("[ImageUpload] Step 2: Validation passed");

    setIsUploading(true);
    try {
      // 2. Compress
      console.log("[ImageUpload] Step 3: Starting compression...");
      const compressedFile = await compressImage(file, "full");
      console.log("[ImageUpload] Step 4: Compression complete", {
        originalSize: file.size,
        compressedSize: compressedFile.size,
      });

      // 3. Upload
      console.log("[ImageUpload] Step 5: Starting upload...");
      const formData = new FormData();
      formData.append("image", compressedFile);
      formData.append("issueId", issueId);

      const result = await uploadIssueImage(formData);
      console.log("[ImageUpload] Step 6: Upload result received", {
        ok: result.ok,
      });

      if (result.ok) {
        console.log("[ImageUpload] Step 7: Upload successful");
        toast({
          title: "Success",
          description: "Image uploaded successfully",
        });
        onUploadComplete?.(result.value);
      } else {
        console.log("[ImageUpload] Upload failed:", result.message);
        toast({
          variant: "destructive",
          title: "Upload failed",
          description: result.message,
        });
      }
    } catch (error) {
      console.error("[ImageUpload] Upload error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred during upload",
      });
    } finally {
      console.log("[ImageUpload] Step 8: Cleanup");
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const isAtLimit = currentCount >= maxCount;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">
          Photos ({currentCount}/{maxCount})
        </Label>
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1 gap-2"
          disabled={(disabled ?? false) || isUploading || isAtLimit}
          onClick={() => fileInputRef.current?.click()}
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ImageIcon className="h-4 w-4" />
          )}
          Upload Photo
        </Button>

        {/* Mobile camera capture button */}
        <Button
          type="button"
          variant="outline"
          className="flex-1 gap-2 md:hidden"
          disabled={(disabled ?? false) || isUploading || isAtLimit}
          onClick={() => {
            if (fileInputRef.current) {
              fileInputRef.current.setAttribute("capture", "environment");
              fileInputRef.current.click();
              // Reset capture attribute after click to not affect standard selection next time
              window.setTimeout(() => {
                fileInputRef.current?.removeAttribute("capture");
              }, 100);
            }
          }}
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Camera className="h-4 w-4" />
          )}
          Take Photo
        </Button>
      </div>

      <Input
        type="file"
        accept="image/*"
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileChange}
      />

      {isAtLimit && (
        <p className="text-xs text-muted-foreground">
          Maximum number of images reached.
        </p>
      )}
    </div>
  );
}
