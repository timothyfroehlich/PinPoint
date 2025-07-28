/**
 * Hook for fetching backbox images from OPDB
 */

import { useState, useEffect } from "react";

import { opdbClient, getBackboxImageUrl } from "~/lib/opdb";

interface UseBackboxImageResult {
  imageUrl: string | null;
  isLoading: boolean;
  error: string | null;
}

interface UseBackboxImageOptions {
  opdbId?: string | null;
  fallbackUrl?: string | null;
}

/**
 * Custom hook to fetch backbox/backglass image from OPDB
 * Falls back to provided fallback URL if OPDB fetch fails
 */
export function useBackboxImage({
  opdbId,
  fallbackUrl = null,
}: UseBackboxImageOptions): UseBackboxImageResult {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const fetchBackboxImage = async (): Promise<void> => {
      if (!opdbId) {
        setImageUrl(fallbackUrl);
        setIsLoading(false);
        setError(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const machineDetails = await opdbClient.getMachineById(opdbId);

        if (isCancelled) return;

        if (machineDetails) {
          const backboxUrl = getBackboxImageUrl(machineDetails);
          setImageUrl(backboxUrl ?? fallbackUrl);
        } else {
          setImageUrl(fallbackUrl);
          setError("Machine not found in OPDB");
        }
      } catch (err) {
        if (isCancelled) return;

        const errorMessage =
          err instanceof Error ? err.message : "Failed to fetch image";
        setError(errorMessage);
        setImageUrl(fallbackUrl);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    void fetchBackboxImage();

    // Cleanup function to cancel the request if component unmounts
    return () => {
      isCancelled = true;
    };
  }, [opdbId, fallbackUrl]);

  return {
    imageUrl,
    isLoading,
    error,
  };
}
