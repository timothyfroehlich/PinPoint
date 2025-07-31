"use client";

import { Person as PersonIcon, Place as PlaceIcon } from "@mui/icons-material";
import {
  Card,
  CardContent,
  Typography,
  Box,
  Avatar,
  Chip,
  Skeleton,
} from "@mui/material";
import { useRouter } from "next/navigation";

import type { RouterOutputs } from "~/trpc/react";

import { useBackboxImage } from "~/hooks/useBackboxImage";

type MachineWithRelations = RouterOutputs["machine"]["core"]["getAll"][number];

interface MachineCardProps {
  machine: MachineWithRelations;
}

export function MachineCard({ machine }: MachineCardProps): React.ReactElement {
  const router = useRouter();
  const machineName = machine.name || machine.model.name;

  // Fetch backbox image from OPDB if available
  const { imageUrl, isLoading } = useBackboxImage({
    opdbId: machine.model.opdbId,
    fallbackUrl: machine.model.opdbImgUrl,
  });

  const handleClick = (): void => {
    router.push(`/machines/${machine.id}`);
  };

  return (
    <Card
      onClick={handleClick}
      sx={{
        borderLeft: 4,
        borderColor: "#667eea",
        cursor: "pointer",
        position: "relative",
        minHeight: 200,
        overflow: "hidden",
        "&:hover": {
          "& .content-overlay": {
            backgroundColor: "rgba(0, 0, 0, 0.8)",
          },
        },
      }}
    >
      {/* Background Image */}
      {imageUrl && !isLoading && (
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: `url(${imageUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            opacity: 0.7,
          }}
        />
      )}

      {/* Loading skeleton for background */}
      {isLoading && (
        <Skeleton
          variant="rectangular"
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}
        />
      )}

      {/* Content Overlay */}
      <Box
        className="content-overlay"
        sx={{
          position: "relative",
          zIndex: 1,
          background: imageUrl
            ? "linear-gradient(135deg, rgba(0, 0, 0, 0.7) 0%, rgba(0, 0, 0, 0.5) 100%)"
            : "transparent",
          height: "100%",
          minHeight: 200,
          transition: "background-color 0.2s ease-in-out",
        }}
      >
        <CardContent
          sx={{
            p: 3,
            height: "100%",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Machine Name */}
          <Typography
            variant="h6"
            fontWeight="medium"
            sx={{
              mb: 1,
              color: imageUrl ? "white" : "text.primary",
              textShadow: imageUrl ? "2px 2px 4px rgba(0, 0, 0, 0.8)" : "none",
            }}
          >
            {machineName}
          </Typography>

          {/* Model Name (if different from machine name) */}
          {machine.name && machine.name !== machine.model.name && (
            <Typography
              variant="body2"
              sx={{
                mb: 2,
                color: imageUrl ? "rgba(255, 255, 255, 0.9)" : "text.secondary",
                textShadow: imageUrl
                  ? "1px 1px 2px rgba(0, 0, 0, 0.8)"
                  : "none",
              }}
            >
              {machine.model.name}
            </Typography>
          )}

          {/* Location */}
          <Box display="flex" alignItems="center" gap={1} sx={{ mb: 1 }}>
            <PlaceIcon
              sx={{
                fontSize: 16,
                color: imageUrl ? "rgba(255, 255, 255, 0.8)" : "text.secondary",
              }}
            />
            <Typography
              variant="body2"
              sx={{
                color: imageUrl ? "rgba(255, 255, 255, 0.9)" : "text.secondary",
                textShadow: imageUrl
                  ? "1px 1px 2px rgba(0, 0, 0, 0.8)"
                  : "none",
              }}
            >
              {machine.location.name}
            </Typography>
          </Box>

          {/* Owner */}
          {machine.owner && (
            <Box display="flex" alignItems="center" gap={1} sx={{ mb: 2 }}>
              <PersonIcon
                sx={{
                  fontSize: 16,
                  color: imageUrl
                    ? "rgba(255, 255, 255, 0.8)"
                    : "text.secondary",
                }}
              />
              <Avatar
                {...(machine.owner.image && { src: machine.owner.image })}
                sx={{ width: 20, height: 20 }}
                alt={machine.owner.name ?? "Owner"}
              />
              <Typography
                variant="body2"
                sx={{
                  color: imageUrl
                    ? "rgba(255, 255, 255, 0.9)"
                    : "text.secondary",
                  textShadow: imageUrl
                    ? "1px 1px 2px rgba(0, 0, 0, 0.8)"
                    : "none",
                }}
              >
                {machine.owner.name}
              </Typography>
            </Box>
          )}

          {/* Model Info - Push to bottom */}
          <Box display="flex" justifyContent="flex-end" sx={{ mt: "auto" }}>
            <Chip
              label={machine.model.name}
              size="small"
              variant={imageUrl ? "filled" : "outlined"}
              sx={
                imageUrl
                  ? {
                      fontSize: "0.75rem",
                      backgroundColor: "rgba(255, 255, 255, 0.2)",
                      color: "white",
                      backdropFilter: "blur(4px)",
                      border: "1px solid rgba(255, 255, 255, 0.3)",
                    }
                  : {
                      fontSize: "0.75rem",
                    }
              }
            />
          </Box>
        </CardContent>
      </Box>
    </Card>
  );
}
