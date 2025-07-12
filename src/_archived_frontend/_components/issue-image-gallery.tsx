"use client";

import {
  Close,
  ZoomIn,
  ZoomOut,
  RotateLeft,
  RotateRight,
  CameraAlt,
} from "@mui/icons-material";
import {
  Box,
  Grid,
  Card,
  CardMedia,
  Dialog,
  IconButton,
  Typography,
  Paper,
} from "@mui/material";
import Image from "next/image";
import React, { useState } from "react";

interface Attachment {
  id: string;
  url: string;
}

interface IssueImageGalleryProps {
  attachments: Attachment[];
  title?: string;
}

export function IssueImageGallery({
  attachments,
  title = "Issue Photos",
}: IssueImageGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  if (!attachments || attachments.length === 0) {
    return null;
  }

  const handleImageClick = (imageUrl: string) => {
    setSelectedImage(imageUrl);
    setLightboxOpen(true);
    setZoom(1);
    setRotation(0);
  };

  const handleCloseLightbox = () => {
    setLightboxOpen(false);
    setSelectedImage(null);
    setZoom(1);
    setRotation(0);
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.25, 0.25));
  };

  const handleRotateLeft = () => {
    setRotation((prev) => prev - 90);
  };

  const handleRotateRight = () => {
    setRotation((prev) => prev + 90);
  };

  return (
    <>
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
          <CameraAlt sx={{ color: "text.secondary" }} />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            ({attachments.length}{" "}
            {attachments.length === 1 ? "photo" : "photos"})
          </Typography>
        </Box>

        <Grid container spacing={2}>
          {attachments.map((attachment, index) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={attachment.id}>
              <Card
                sx={{
                  cursor: "pointer",
                  transition: "transform 0.2s ease",
                  "&:hover": {
                    transform: "scale(1.02)",
                    boxShadow: 3,
                  },
                }}
                onClick={() => handleImageClick(attachment.url)}
              >
                <CardMedia
                  component="img"
                  height="200"
                  image={attachment.url}
                  alt={`Issue photo ${index + 1}`}
                  sx={{
                    objectFit: "cover",
                    backgroundColor: "grey.100",
                  }}
                />
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Lightbox Modal */}
      <Dialog
        open={lightboxOpen}
        onClose={handleCloseLightbox}
        maxWidth={false}
        fullWidth
        sx={{
          "& .MuiDialog-paper": {
            backgroundColor: "transparent",
            boxShadow: "none",
            maxWidth: "100vw",
            maxHeight: "100vh",
            m: 0,
          },
        }}
      >
        {/* Backdrop */}
        <Box
          sx={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.9)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1,
          }}
          onClick={handleCloseLightbox}
        >
          {/* Controls Bar */}
          <Paper
            sx={{
              position: "fixed",
              top: 20,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 2,
              backgroundColor: "rgba(0, 0, 0, 0.7)",
              backdropFilter: "blur(8px)",
              display: "flex",
              alignItems: "center",
              gap: 1,
              p: 1,
              borderRadius: 2,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <IconButton
              onClick={handleZoomOut}
              disabled={zoom <= 0.25}
              sx={{ color: "white" }}
              size="small"
            >
              <ZoomOut />
            </IconButton>
            <Typography
              variant="body2"
              sx={{ color: "white", minWidth: "60px", textAlign: "center" }}
            >
              {Math.round(zoom * 100)}%
            </Typography>
            <IconButton
              onClick={handleZoomIn}
              disabled={zoom >= 3}
              sx={{ color: "white" }}
              size="small"
            >
              <ZoomIn />
            </IconButton>
            <IconButton
              onClick={handleRotateLeft}
              sx={{ color: "white" }}
              size="small"
            >
              <RotateLeft />
            </IconButton>
            <IconButton
              onClick={handleRotateRight}
              sx={{ color: "white" }}
              size="small"
            >
              <RotateRight />
            </IconButton>
            <IconButton
              onClick={handleCloseLightbox}
              sx={{ color: "white", ml: 1 }}
              size="small"
            >
              <Close />
            </IconButton>
          </Paper>

          {/* Image Container */}
          {selectedImage && (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                height: "100%",
                p: 8, // Padding to ensure controls don't overlap
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <Image
                src={selectedImage}
                alt="Full size"
                width={800}
                height={600}
                style={{
                  maxWidth: "100%",
                  maxHeight: "100%",
                  objectFit: "contain",
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  transition: "transform 0.2s ease",
                  userSelect: "none",
                  pointerEvents: "none",
                }}
              />
            </Box>
          )}
        </Box>
      </Dialog>
    </>
  );
}
