/**
 * Placeholder ProfilePictureUpload Component
 * TODO: Implement full profile picture upload functionality
 */

interface ProfilePictureUploadProps {
  currentImage?: string;
  onImageChange?: (imageUrl: string) => void;
}

export function ProfilePictureUpload({ currentImage, onImageChange }: ProfilePictureUploadProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-4">
        <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center">
          {currentImage ? (
            <img 
              src={currentImage} 
              alt="Profile" 
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <span className="text-2xl text-gray-400">👤</span>
          )}
        </div>
        
        <div className="space-y-2">
          <h3 className="text-lg font-medium">Profile Picture</h3>
          <p className="text-sm text-gray-500">
            Profile picture upload is coming soon.
          </p>
        </div>
      </div>
    </div>
  );
}