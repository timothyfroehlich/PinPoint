"use client";

import { CloudUpload, PhotoCamera } from "@mui/icons-material";
import {
  Box,
  Button,
  CircularProgress,
  Alert,
  Typography,
  Paper,
} from "@mui/material";
import React, { useState, useRef } from "react";

import { UserAvatar } from "./user-avatar";

import { processImageFile } from "~/lib/utils/image-processing";
import { api } from "~/trpc/react";

interface ProfilePictureUploadProps {
  currentUser: {
    id: string;
    name?: string | null;
    profilePicture?: string | null;
  };
  onUploadSuccess?: (newProfilePicture: string) => void;
  size?: "small" | "medium" | "large";
}

export function ProfilePictureUpload({
  currentUser,
  onUploadSuccess,
  size = "large",
}: ProfilePictureUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const uploadMutation = api.user.uploadProfilePicture.useMutation({
    onSuccess: (result) => {
      setPreviewUrl(null);
      setUploadError(null);
      onUploadSuccess?.(result.profilePicture!);
    },
    onError: (error) => {
      setUploadError(error.message);
      setPreviewUrl(null);
    },
  });

  const handleFileSelect = async (file: File) => {
    setUploadError(null);

    const result = await processImageFile(file);
    if (!result.success) {
      setUploadError(result.error!);
      return;
    }

    // Show preview
    const previewObjectUrl = URL.createObjectURL(result.file!);
    setPreviewUrl(previewObjectUrl);

    // Convert to base64 for upload
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Data = e.target?.result as string;
      uploadMutation.mutate({
        imageData: base64Data,
        filename: result.file!.name,
      });
    };
    reader.readAsDataURL(result.file!);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0 && files[0]) {
      void handleFileSelect(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0 && files[0]) {
      void handleFileSelect(files[0]);
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  // Clean up preview URL when component unmounts
  React.useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const displayUser = previewUrl
    ? { ...currentUser, profilePicture: previewUrl }
    : currentUser;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
      }}
    >
      {/* Current/Preview Avatar */}
      <Box sx={{ position: "relative" }}>
        <UserAvatar user={displayUser} size={size} showTooltip={false} />
        {uploadMutation.isPending && (
          <Box
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              borderRadius: "50%",
            }}
          >
            <CircularProgress size={24} sx={{ color: "white" }} />
          </Box>
        )}
      </Box>

      {/* Upload Area */}
      <Paper
        sx={{
          p: 3,
          textAlign: "center",
          border: (theme) =>
            `2px dashed ${isDragging ? theme.palette.primary.main : theme.palette.divider}`,
          backgroundColor: (theme) =>
            isDragging ? theme.palette.action.hover : "transparent",
          cursor: "pointer",
          minWidth: 300,
          transition: "all 0.2s ease",
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={openFileDialog}
      >
        <CloudUpload
          sx={{
            fontSize: 48,
            color: (theme) => theme.palette.text.secondary,
            mb: 1,
          }}
        />
        <Typography variant="h6" gutterBottom>
          Upload Profile Picture
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Drag and drop an image here, or click to select
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Supports JPEG, PNG, WebP • Max 5MB • Automatically resized to 400x400
        </Typography>
      </Paper>

      {/* Upload Button */}
      <Button
        variant="contained"
        startIcon={<PhotoCamera />}
        onClick={openFileDialog}
        disabled={uploadMutation.isPending}
        sx={{ minWidth: 160 }}
      >
        {uploadMutation.isPending ? "Uploading..." : "Choose File"}
      </Button>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileInputChange}
        style={{ display: "none" }}
      />

      {/* Error Display */}
      {uploadError && (
        <Alert severity="error" sx={{ width: "100%", maxWidth: 400 }}>
          {uploadError}
        </Alert>
      )}

      {/* Success State */}
      {uploadMutation.isSuccess && (
        <Alert severity="success" sx={{ width: "100%", maxWidth: 400 }}>
          Profile picture updated successfully!
        </Alert>
      )}
    </Box>
  );
}
