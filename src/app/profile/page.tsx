"use client";

import {
  Edit,
  Calendar,
  Gamepad2,
  Bug,
  MessageCircle,
  Grid3X3,
  List,
  LogOut,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { cn } from "~/lib/utils";
import React, { useState } from "react";

import { useAuth } from "~/app/auth-provider";
import { ProfilePictureUpload } from "~/components/profile/ProfilePictureUpload";
import { UserAvatar } from "~/components/ui/UserAvatar";
import { api } from "~/trpc/react";

function SignOutButton(): React.JSX.Element {
  const { signOut } = useAuth();

  const handleSignOut = async (): Promise<void> => {
    try {
      await signOut();
      window.location.href = "/";
    } catch (error) {
      console.error("Sign out failed:", error);
    }
  };

  return (
    <Button
      variant="outline"
      onClick={() => void handleSignOut()}
      className="w-full sm:w-auto border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
    >
      <LogOut className="mr-2 h-4 w-4" />
      Sign Out
    </Button>
  );
}

export default function ProfilePage(): React.JSX.Element {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", bio: "" });
  const [gamesViewMode, setGamesViewMode] = useState<"grid" | "list">("grid");

  const {
    data: userProfile,
    isLoading,
    error,
    refetch,
  } = api.user.getProfile.useQuery();

  const updateProfileMutation = api.user.updateProfile.useMutation({
    onSuccess: () => {
      setEditDialogOpen(false);
      void refetch();
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-6xl py-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
        <h2 className="text-lg font-semibold mt-4">Loading profile...</h2>
      </div>
    );
  }

  if (error || !userProfile) {
    return (
      <div className="container mx-auto max-w-6xl py-8">
        <Alert className="border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive">
          <AlertDescription>
            Error loading profile: {error?.message ?? "Profile not found"}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const handleEditProfile = (): void => {
    setEditForm({
      name: userProfile.name ?? "",
      bio: userProfile.bio ?? "",
    });
    setEditDialogOpen(true);
  };

  const handleSaveProfile = (): void => {
    updateProfileMutation.mutate({
      name: editForm.name.trim() || undefined,
      bio: editForm.bio.trim() || undefined,
    });
  };

  const handleUploadSuccess = (): void => {
    setUploadDialogOpen(false);
    void refetch();
  };

  const joinDate = new Date(userProfile.createdAt);
  const formattedJoinDate = joinDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const _count = userProfile._count;
  const memberships = userProfile.memberships;
  const ownedMachines = userProfile.ownedMachines;

  return (
    <div className="container mx-auto max-w-6xl py-8 space-y-6">
      {/* Profile Header */}
      <Card className="shadow-md">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <UserAvatar user={userProfile} size="large" showTooltip={false} />
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-3xl font-bold mb-2">
                {userProfile.name ?? "Unnamed User"}
              </h1>
              {/* Note: Email is handled by Supabase Auth, not stored in user profile */}
              {userProfile.bio && (
                <p className="text-muted-foreground mb-4">{userProfile.bio}</p>
              )}
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Joined {formattedJoinDate}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                onClick={handleEditProfile}
                disabled={updateProfileMutation.isPending}
                className="w-full sm:w-auto"
              >
                <Edit className="mr-2 h-4 w-4" />
                Edit Profile
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setUploadDialogOpen(true);
                }}
                className="w-full sm:w-auto"
              >
                Change Picture
              </Button>
              <SignOutButton />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Statistics</h3>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Gamepad2 className="h-5 w-5 text-primary" />
              <span className="text-sm">
                {String(_count.ownedMachines)} games owned
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Bug className="h-5 w-5 text-secondary" />
              <span className="text-sm">
                {String(_count.issuesCreated)} issues reported
              </span>
            </div>
            <div className="flex items-center gap-3">
              <MessageCircle className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm">
                {String(_count.comments)} comments posted
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Organizations */}
        <Card className="md:col-span-2">
          <CardHeader>
            <h3 className="text-lg font-semibold">Organizations</h3>
          </CardHeader>
          <CardContent>
            {memberships.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Not a member of any organizations
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {memberships.map((membership: unknown) => {
                  const membershipData = membership as Record<string, unknown>;
                  const organization = membershipData["organization"] as
                    | { name?: string }
                    | undefined;
                  const role = membershipData["role"] as
                    | { name?: string }
                    | undefined;
                  return (
                    <Badge
                      key={membershipData["id"] as string}
                      variant={role?.name === "admin" ? "default" : "outline"}
                      className={cn(
                        role?.name === "admin" &&
                          "bg-primary text-primary-foreground",
                      )}
                    >
                      {organization?.name ?? "Unknown"} (
                      {role?.name ?? "Unknown"})
                    </Badge>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Owned Games */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              Owned Games ({String(ownedMachines.length)})
            </h3>
            {ownedMachines.length > 0 && (
              <TooltipProvider>
                <ToggleGroup
                  type="single"
                  value={gamesViewMode}
                  onValueChange={(value) => {
                    if (value) setGamesViewMode(value as "grid" | "list");
                  }}
                  className="border"
                >
                  <ToggleGroupItem value="grid" size="sm">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Grid3X3 className="h-4 w-4" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Grid View</p>
                      </TooltipContent>
                    </Tooltip>
                  </ToggleGroupItem>
                  <ToggleGroupItem value="list" size="sm">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <List className="h-4 w-4" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>List View</p>
                      </TooltipContent>
                    </Tooltip>
                  </ToggleGroupItem>
                </ToggleGroup>
              </TooltipProvider>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {ownedMachines.length === 0 ? (
            <p className="text-sm text-muted-foreground">No games owned yet</p>
          ) : gamesViewMode === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {ownedMachines.map((machine) => (
                <Card key={machine.id} className="border h-full">
                  <CardContent className="p-4">
                    <h4 className="font-semibold truncate mb-2">
                      {machine.name}
                    </h4>
                    <p className="text-sm text-muted-foreground mb-1">
                      {machine.model.name}
                    </p>
                    {machine.model.manufacturer && (
                      <p className="text-xs text-muted-foreground">
                        {machine.model.manufacturer}
                        {machine.model.year &&
                          ` • ${String(machine.model.year)}`}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      @ {machine.location.name}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-0">
              {ownedMachines.map((machine, index) => (
                <div
                  key={machine.id}
                  className={cn(
                    "py-4 px-0",
                    index < ownedMachines.length - 1 && "border-b",
                  )}
                >
                  <div>
                    <h4 className="font-medium">{machine.name}</h4>
                    <div className="text-sm text-muted-foreground">
                      {machine.model.name}
                      {machine.model.manufacturer && (
                        <> • {machine.model.manufacturer}</>
                      )}
                      {machine.model.year && (
                        <> • {String(machine.model.year)}</>
                      )}
                      <br />
                      <span className="text-xs">@ {machine.location.name}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Profile Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Display Name</Label>
              <Input
                id="name"
                value={editForm.name}
                onChange={(e) => {
                  setEditForm({ ...editForm, name: e.target.value });
                }}
                placeholder="Enter your display name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={editForm.bio}
                onChange={(e) => {
                  setEditForm({ ...editForm, bio: e.target.value });
                }}
                placeholder="Tell us about yourself..."
                maxLength={500}
                rows={3}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground text-right">
                {String(editForm.bio.length)}/500 characters
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveProfile}
              disabled={updateProfileMutation.isPending}
            >
              {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Upload Picture Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Change Profile Picture</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <ProfilePictureUpload
              currentUser={userProfile}
              onUploadSuccess={handleUploadSuccess}
              size="large"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setUploadDialogOpen(false);
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
