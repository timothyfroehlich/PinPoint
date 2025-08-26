import { useEffect, useState } from "react";

/**
 * Hook to detect when component has mounted on client-side
 * Prevents hydration mismatches by ensuring consistent SSR/client rendering
 *
 * @returns {boolean} true when component has mounted on client, false during SSR
 */
export function useClientMounted(): boolean {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return mounted;
}
