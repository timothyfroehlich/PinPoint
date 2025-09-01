/**
 * Placeholder ProfilePictureUpload Component
 * TODO: Implement full profile picture upload functionality
 */

interface UserProfileResponse {
  id: string;
  name: string | null;
  email?: string | null;
  image?: string | null;
  profile_picture?: string | null;
}

interface ProfilePictureUploadProps {
  currentUser: UserProfileResponse;
  onUploadSuccess: () => void;
  size: string;
  currentImage?: string;
  onImageChange?: (imageUrl: string) => void;
}

export function ProfilePictureUpload({
  currentUser: _currentUser,
  onUploadSuccess: _onUploadSuccess,
  size: _size,
  currentImage,
  onImageChange: _onImageChange,
}: ProfilePictureUploadProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-4">
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
          {currentImage ? (
            <img
              src={currentImage}
              alt="Profile"
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <span className="text-2xl text-muted-foreground">👤</span>
          )}
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-medium">Profile Picture</h3>
          <p className="text-sm text-muted-foreground">
            Profile picture upload is coming soon.
          </p>
        </div>
      </div>
    </div>
  );
}
