"use client";

import { Avatar, Tooltip } from "@mui/material";
import { useState } from "react";

interface UserAvatarProps {
  user?: {
    id: string;
    name?: string | null;
    profilePicture?: string | null;
  } | null;
  size?: "small" | "medium" | "large";
  clickable?: boolean;
  showTooltip?: boolean;
  onClick?: () => void;
}

const SIZE_MAP = {
  small: { width: 32, height: 32 },
  medium: { width: 40, height: 40 },
  large: { width: 64, height: 64 },
} as const;

export function UserAvatar({
  user,
  size = "medium",
  clickable = false,
  showTooltip = true,
  onClick,
}: UserAvatarProps) {
  const [imageError, setImageError] = useState(false);

  if (!user) {
    return (
      <Avatar
        sx={{
          ...SIZE_MAP[size],
          cursor: clickable ? "pointer" : "default",
        }}
        onClick={onClick}
      >
        ?
      </Avatar>
    );
  }

  const displayName = user.name ?? "Unknown User";
  const initials = displayName
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");

  const avatarSrc =
    !imageError && user.profilePicture ? user.profilePicture : undefined;

  const avatarElement = (
    <Avatar
      src={avatarSrc}
      alt={`${displayName}'s profile picture`}
      sx={{
        ...SIZE_MAP[size],
        cursor: clickable ? "pointer" : "default",
        "&:hover": clickable ? { opacity: 0.8 } : {},
      }}
      onClick={onClick}
      onError={() => setImageError(true)}
    >
      {!avatarSrc && initials}
    </Avatar>
  );

  if (showTooltip && displayName) {
    return (
      <Tooltip title={displayName} arrow>
        {avatarElement}
      </Tooltip>
    );
  }

  return avatarElement;
}
