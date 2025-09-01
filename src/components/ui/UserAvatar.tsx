"use client";

import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { useState } from "react";
import { cn } from "~/lib/utils";

import type { JSX } from "react";

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

const SIZE_CLASSES = {
  small: "h-8 w-8 text-sm",
  medium: "h-10 w-10 text-sm",
  large: "h-16 w-16 text-lg",
} as const;

export function UserAvatar({
  user,
  size = "medium",
  clickable = false,
  showTooltip = true,
  onClick,
}: UserAvatarProps): JSX.Element {
  const [imageError, setImageError] = useState(false);

  if (!user) {
    const avatarElement = (
      <Avatar
        className={cn(
          SIZE_CLASSES[size],
          clickable && "cursor-pointer hover:opacity-80",
        )}
        onClick={onClick}
      >
        <AvatarFallback>?</AvatarFallback>
      </Avatar>
    );

    return showTooltip ? (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{avatarElement}</TooltipTrigger>
          <TooltipContent>
            <p>Unknown User</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    ) : (
      avatarElement
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
      className={cn(
        SIZE_CLASSES[size],
        clickable && "cursor-pointer hover:opacity-80",
      )}
      onClick={onClick}
    >
      {avatarSrc && (
        <AvatarImage
          src={avatarSrc}
          alt={`${displayName}'s profile picture`}
          onError={() => {
            setImageError(true);
          }}
        />
      )}
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  );

  if (showTooltip && displayName) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{avatarElement}</TooltipTrigger>
          <TooltipContent>
            <p>{displayName}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return avatarElement;
}
