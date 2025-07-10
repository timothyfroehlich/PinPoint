"use client";

import {
  CloudUpload,
  PhotoCamera,
  Delete,
  CameraAlt,
} from "@mui/icons-material";
import {
  Box,
  Button,
  CircularProgress,
  Alert,
  Typography,
  IconButton,
  Card,
  CardMedia,
} from "@mui/material";
import React, { useState, useRef } from "react";

import { processIssueImageFile } from "~/lib/utils/image-processing";

export interface IssueAttachment {
  id?: string;
  url: string;
  file?: File; // For new uploads before save
}

interface UploadErrorResponse {
  error: string;
}

interface UploadSuccessResponse {
  attachment: {
    id: string;
    url: string;
  };
}

interface IssueImageUploadProps {
  issueId?: string; // Optional - if provided, uploads immediately
  attachments?: IssueAttachment[]; // Existing attachments
  onAttachmentsChange?: (attachments: IssueAttachment[]) => void;
  onUploadSuccess?: (attachment: IssueAttachment) => void;
  onDeleteSuccess?: (attachmentId: string) => void;
  maxAttachments?: number;
  disabled?: boolean;
}

export function IssueImageUpload({
  issueId,
  attachments = [],
  onAttachmentsChange,
  onUploadSuccess,
  onDeleteSuccess,
  maxAttachments = 3,
  disabled = false,
}: IssueImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());

  const canAddMore = attachments.length < maxAttachments;

  const handleFileSelect = async (files: File[]) => {
    if (!canAddMore) {
      setUploadError(`Maximum of ${maxAttachments} images allowed`);
      return;
    }

    setUploadError(null);
    const filesToProcess = files.slice(0, maxAttachments - attachments.length);

    for (const file of filesToProcess) {
      const fileId = `${Date.now()}-${Math.random()}`; // Temporary ID for tracking
      setUploadingFiles((prev) => new Set(prev).add(fileId));

      try {
        // Process image with higher quality constraints for issues
        const result = await processIssueImageFile(file);
        if (!result.success) {
          setUploadError(result.error!);
          setUploadingFiles((prev) => {
            const newSet = new Set(prev);
            newSet.delete(fileId);
            return newSet;
          });
          continue;
        }

        if (issueId) {
          // Upload immediately if issueId is provided
          await uploadToServer(result.file!, issueId, fileId);
        } else {
          // Store temporarily for form submission
          const previewUrl = URL.createObjectURL(result.file!);
          const newAttachment: IssueAttachment = {
            url: previewUrl,
            file: result.file!,
          };

          const newAttachments = [...attachments, newAttachment];
          onAttachmentsChange?.(newAttachments);

          setUploadingFiles((prev) => {
            const newSet = new Set(prev);
            newSet.delete(fileId);
            return newSet;
          });
        }
      } catch (error) {
        console.error("Error processing image:", error);
        setUploadError("Failed to process image");
        setUploadingFiles((prev) => {
          const newSet = new Set(prev);
          newSet.delete(fileId);
          return newSet;
        });
      }
    }
  };

  const uploadToServer = async (
    file: File,
    targetIssueId: string,
    fileId: string,
  ) => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("issueId", targetIssueId);

      const response = await fetch("/api/upload/issue", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData: unknown = await response.json();
        let errorMessage = "Upload failed";

        // Type guard for error response
        if (
          errorData &&
          typeof errorData === "object" &&
          "error" in errorData &&
          typeof (errorData as UploadErrorResponse).error === "string"
        ) {
          errorMessage = (errorData as UploadErrorResponse).error;
        }

        throw new Error(errorMessage);
      }

      const result: unknown = await response.json();

      // Type guard for success response
      if (!result || typeof result !== "object" || !("attachment" in result)) {
        throw new Error("Invalid response format");
      }

      const successResult = result as UploadSuccessResponse;
      const newAttachment: IssueAttachment = {
        id: successResult.attachment.id,
        url: successResult.attachment.url,
      };

      onUploadSuccess?.(newAttachment);
      setUploadingFiles((prev) => {
        const newSet = new Set(prev);
        newSet.delete(fileId);
        return newSet;
      });
    } catch (error) {
      console.error("Upload error:", error);
      setUploadError(error instanceof Error ? error.message : "Upload failed");
      setUploadingFiles((prev) => {
        const newSet = new Set(prev);
        newSet.delete(fileId);
        return newSet;
      });
    }
  };

  const handleDelete = async (attachment: IssueAttachment, index: number) => {
    if (attachment.id && issueId) {
      // Delete from server
      try {
        // We'll need to add a delete endpoint or use tRPC mutation
        // For now, we'll just call the onDeleteSuccess callback
        onDeleteSuccess?.(attachment.id);
      } catch (error) {
        console.error("Delete error:", error);
        setUploadError("Failed to delete attachment");
      }
    } else {
      // Remove from local state
      const newAttachments = attachments.filter((_, i) => i !== index);
      onAttachmentsChange?.(newAttachments);

      // Clean up object URL if it's a temporary preview
      if (attachment.url.startsWith("blob:")) {
        URL.revokeObjectURL(attachment.url);
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files).filter((file) =>
      file.type.startsWith("image/"),
    );

    if (files.length > 0) {
      void handleFileSelect(files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) {
      void handleFileSelect(files);
    }
    // Reset input
    e.target.value = "";
  };

  const openFileDialog = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  const openCameraDialog = () => {
    if (!disabled) {
      cameraInputRef.current?.click();
    }
  };

  // Clean up object URLs when component unmounts
  React.useEffect(() => {
    return () => {
      attachments.forEach((attachment) => {
        if (attachment.url.startsWith("blob:")) {
          URL.revokeObjectURL(attachment.url);
        }
      });
    };
  }, [attachments]);

  const isUploading = uploadingFiles.size > 0;

  return (
    <Box sx={{ width: "100%" }}>
      {/* Existing Attachments - Compact Row Layout */}
      {attachments.length > 0 && (
        <Box sx={{ display: "flex", gap: 1, mb: 2, flexWrap: "wrap" }}>
          {attachments.map((attachment, index) => (
            <Box key={attachment.id ?? index} sx={{ position: "relative" }}>
              <Card sx={{ width: 80, height: 80 }}>
                <CardMedia
                  component="img"
                  height="80"
                  image={attachment.url}
                  alt={`Attachment ${index + 1}`}
                  sx={{ objectFit: "cover", cursor: "pointer" }}
                />
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => handleDelete(attachment, index)}
                  disabled={disabled}
                  sx={{
                    position: "absolute",
                    top: 2,
                    right: 2,
                    backgroundColor: "rgba(255, 255, 255, 0.9)",
                    "&:hover": {
                      backgroundColor: "rgba(255, 255, 255, 1)",
                    },
                    width: 20,
                    height: 20,
                  }}
                >
                  <Delete sx={{ fontSize: 14 }} />
                </IconButton>
              </Card>
            </Box>
          ))}
        </Box>
      )}

      {/* Compact Upload Area */}
      {canAddMore && !disabled && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            p: 2,
            border: (theme) =>
              `1px dashed ${isDragging ? theme.palette.primary.main : theme.palette.divider}`,
            backgroundColor: (theme) =>
              isDragging ? theme.palette.action.hover : "transparent",
            borderRadius: 1,
            cursor: "pointer",
            transition: "all 0.2s ease",
            position: "relative",
          }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={openFileDialog}
        >
          {isUploading && (
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
                backgroundColor: "rgba(255, 255, 255, 0.8)",
                zIndex: 1,
                borderRadius: 1,
              }}
            >
              <CircularProgress size={20} />
            </Box>
          )}

          <CloudUpload
            sx={{
              fontSize: 24,
              color: (theme) => theme.palette.text.secondary,
            }}
          />

          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              Add photos (up to {maxAttachments - attachments.length} more)
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Drag & drop or click to select • JPEG, PNG, WebP • Max 5MB
            </Typography>
          </Box>

          {/* Compact Upload Buttons */}
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<PhotoCamera />}
              onClick={(e) => {
                e.stopPropagation();
                openFileDialog();
              }}
              disabled={isUploading}
            >
              Files
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<CameraAlt />}
              onClick={(e) => {
                e.stopPropagation();
                openCameraDialog();
              }}
              disabled={isUploading}
            >
              Camera
            </Button>
          </Box>
        </Box>
      )}

      {/* Compact Alert (when at capacity) */}
      {!canAddMore && !disabled && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontStyle: "italic" }}
        >
          Maximum of {maxAttachments} images reached. Delete an image to add
          more.
        </Typography>
      )}

      {/* Hidden File Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={handleFileInputChange}
        style={{ display: "none" }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment" // Use rear camera by default
        onChange={handleFileInputChange}
        style={{ display: "none" }}
      />

      {/* Error Display */}
      {uploadError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {uploadError}
        </Alert>
      )}

      {/* Loading State */}
      {isUploading && (
        <Alert severity="info" sx={{ mt: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <CircularProgress size={16} />
            Uploading images...
          </Box>
        </Alert>
      )}
    </Box>
  );
}
