"use client";

import { CloudUpload } from "@mui/icons-material";
import { Box, CircularProgress, Alert, Typography, Paper } from "@mui/material";
import Image from "next/image";
import React, { useState, useRef, useEffect } from "react";

import { processImageFile } from "~/lib/utils/image-processing";

interface OrganizationLogoUploadProps {
  currentLogoUrl: string | null | undefined;
  onUploadComplete: (newUrl: string) => void;
}

export function OrganizationLogoUpload({
  currentLogoUrl,
  onUploadComplete,
}: OrganizationLogoUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileSelect = async (file: File) => {
    setUploadError(null);
    setIsUploading(true);

    const result = await processImageFile(file);
    if (!result.success || !result.file) {
      setUploadError(result.error ?? "Failed to process image.");
      setIsUploading(false);
      return;
    }

    const previewObjectUrl = URL.createObjectURL(result.file);
    setPreviewUrl(previewObjectUrl);

    const formData = new FormData();
    formData.append("file", result.file);

    try {
      const response = await fetch("/api/upload/organization-logo", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { error?: string };
        throw new Error(errorData.error ?? "Upload failed");
      }

      const data = (await response.json()) as { imageUrl: string };
      onUploadComplete(data.imageUrl);
      setUploadError(null);
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : "An unknown error occurred",
      );
    } finally {
      setIsUploading(false);
      setPreviewUrl(null); // Clear preview after upload attempt
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void handleFileSelect(file);
    }
  };

  const openFileDialog = () => fileInputRef.current?.click();

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const displayLogoUrl = previewUrl ?? currentLogoUrl;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, my: 2 }}>
      <Typography variant="h6">Organization Logo</Typography>
      {displayLogoUrl && (
        <Box sx={{ position: "relative", width: 120, height: 120 }}>
          <Image
            src={displayLogoUrl}
            alt="Organization Logo"
            layout="fill"
            objectFit="contain"
          />
        </Box>
      )}
      <Paper
        sx={{
          p: 3,
          textAlign: "center",
          border: (theme) =>
            `2px dashed ${isDragging ? theme.palette.primary.main : theme.palette.divider}`,
          backgroundColor: (theme) =>
            isDragging ? theme.palette.action.hover : "transparent",
          cursor: "pointer",
          transition: "all 0.2s ease",
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={openFileDialog}
      >
        <CloudUpload sx={{ fontSize: 48, color: "text.secondary", mb: 1 }} />
        <Typography variant="body2" color="text.secondary">
          Drag & drop new logo, or click to select
        </Typography>
        <Typography variant="caption" color="text.secondary">
          JPEG, PNG, WebP • Max 2MB
        </Typography>
        {isUploading && <CircularProgress sx={{ mt: 2 }} />}
      </Paper>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileInputChange}
        style={{ display: "none" }}
      />
      {uploadError && <Alert severity="error">{uploadError}</Alert>}
    </Box>
  );
}
