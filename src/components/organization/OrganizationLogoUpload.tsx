"use client";

import { CloudUpload, Business } from "@mui/icons-material";
import {
  Box,
  Button,
  CircularProgress,
  Alert,
  Typography,
  Paper,
  Avatar,
} from "@mui/material";
import React, { useState, useRef } from "react";

import type { JSX } from "react";

import { processImageFile } from "~/lib/utils/image-processing";
import { api } from "~/trpc/react";

interface OrganizationLogoUploadProps {
  currentOrganization: {
    id: string;
    name: string;
    logoUrl?: string | null;
  };
  onUploadSuccess?: (newLogoUrl: string) => void;
  size?: number;
}

export function OrganizationLogoUpload({
  currentOrganization,
  onUploadSuccess,
  size = 120,
}: OrganizationLogoUploadProps): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const uploadMutation = api.organization.uploadLogo.useMutation({
    onSuccess: (result) => {
      setPreviewUrl(null);
      setUploadError(null);
      if (result.logoUrl) {
        onUploadSuccess?.(result.logoUrl);
      }
    },
    onError: (error) => {
      setUploadError(error.message);
      setPreviewUrl(null);
    },
  });

  const handleFileSelect = async (file: File): Promise<void> => {
    setUploadError(null);

    const result = await processImageFile(file);
    if (!result.success || !result.file) {
      setUploadError(result.error ?? "Failed to process image");
      return;
    }

    const processedFile = result.file;

    // Show preview
    const previewObjectUrl = URL.createObjectURL(processedFile);
    setPreviewUrl(previewObjectUrl);

    // Convert to base64 for upload
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Data = e.target?.result as string;
      uploadMutation.mutate({
        imageData: base64Data,
        filename: processedFile.name,
      });
    };
    reader.readAsDataURL(processedFile);
  };

  const handleDrop = (e: React.DragEvent): void => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0 && files[0]) {
      void handleFileSelect(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent): void => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (): void => {
    setIsDragging(false);
  };

  const handleFileInputChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ): void => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0 && files[0]) {
      void handleFileSelect(files[0]);
    }
  };

  const openFileDialog = (): void => {
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

  const displayLogoUrl = previewUrl ?? currentOrganization.logoUrl;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
      }}
    >
      {/* Current/Preview Logo */}
      <Box sx={{ position: "relative" }}>
        <Avatar
          {...(displayLogoUrl && { src: displayLogoUrl })}
          alt={`${currentOrganization.name} logo`}
          sx={{
            width: size,
            height: size,
            bgcolor: "primary.main",
            fontSize: size / 3,
          }}
        >
          {!displayLogoUrl && <Business sx={{ fontSize: size / 2 }} />}
        </Avatar>
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

      {/* Organization Name */}
      <Typography variant="h6" color="text.primary">
        {currentOrganization.name}
      </Typography>

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
          Upload Organization Logo
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Drag and drop an image here, or click to select
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Supports JPEG, PNG, WebP • Max 2MB • Automatically resized to 400x400
        </Typography>
      </Paper>

      {/* Upload Button */}
      <Button
        variant="contained"
        startIcon={<Business />}
        onClick={openFileDialog}
        disabled={uploadMutation.isPending}
        sx={{ minWidth: 160 }}
      >
        {uploadMutation.isPending ? "Uploading..." : "Choose Logo"}
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
          Organization logo updated successfully!
        </Alert>
      )}
    </Box>
  );
}
