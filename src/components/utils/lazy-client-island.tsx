/**
 * Lazy Client Island Wrapper
 * Phase 3D: Dynamic imports for non-critical client islands
 * Reduces initial bundle size and improves performance
 */

"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { type ComponentType } from "react";

interface LazyClientIslandProps<T = Record<string, unknown>> {
  /** Component to lazy load */
  importComponent: () => Promise<{ default: ComponentType<T> }>;
  /** Props to pass to the lazy component */
  componentProps: T;
  /** Fallback component while loading */
  fallback?: React.ReactNode;
  /** Whether to load immediately (default: false) */
  loadImmediately?: boolean;
  /** Intersection observer threshold (default: 0.1) */
  threshold?: number;
  /** Loading strategy: 'intersection' | 'idle' | 'immediate' */
  strategy?: "intersection" | "idle" | "immediate";
  /** Component name for debugging */
  name?: string;
}

/**
 * Lazy loading wrapper for client islands
 * Uses Intersection Observer or requestIdleCallback for optimal loading
 */
export function LazyClientIsland<T = Record<string, unknown>>({
  importComponent,
  componentProps,
  fallback = <div className="h-16 bg-muted animate-pulse rounded" />,
  loadImmediately = false,
  threshold = 0.1,
  strategy = "intersection",
  name = "LazyComponent",
}: LazyClientIslandProps<T>): JSX.Element | null {
  const [Component, setComponent] = useState<ComponentType<T> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load component immediately if requested
  useEffect(() => {
    if (loadImmediately || strategy === "immediate") {
      void loadComponent();
    }
  }, [loadImmediately, strategy]);

  // Intersection observer loading
  useEffect(() => {
    if (Component || isLoading || strategy !== "intersection") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          void loadComponent();
          observer.disconnect();
        }
      },
      { threshold },
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [Component, isLoading, strategy, threshold]);

  // Idle loading
  useEffect(() => {
    if (Component || isLoading || strategy !== "idle") return;

    const loadOnIdle = (): void => {
      if ("requestIdleCallback" in window) {
        requestIdleCallback(() => void loadComponent(), { timeout: 2000 });
      } else {
        // Fallback for browsers without requestIdleCallback
        setTimeout(() => void loadComponent(), 1000);
      }
    };

    loadOnIdle();
  }, [Component, isLoading, strategy]);

  const loadComponent = async (): Promise<void> => {
    if (Component || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const { default: ImportedComponent } = await importComponent();
      setComponent(() => ImportedComponent);

      // Performance monitoring
      if (process.env.NODE_ENV === "development") {
        console.log(`✅ Lazy loaded client island: ${name}`);
      }
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error("Failed to load component");
      setError(error);
      console.error(`❌ Failed to lazy load client island ${name}:`, error);
    } finally {
      setIsLoading(false);
    }
  };

  // Error state
  if (error) {
    return (
      <div className="rounded-md border border-error bg-error-container p-4">
        <div className="text-sm text-on-error-container">
          <strong>Failed to load component:</strong> {error.message}
        </div>
        <button
          onClick={() => {
            setError(null);
            void loadComponent();
          }}
          className="mt-2 text-xs text-error hover:text-error underline"
        >
          Retry
        </button>
      </div>
    );
  }

  // Loading state
  if (isLoading || !Component) {
    return (
      <div ref={containerRef} data-lazy-loading={name}>
        {fallback}
      </div>
    );
  }

  // Render loaded component
  return (
    <div ref={containerRef} data-lazy-loaded={name}>
      <Suspense fallback={fallback}>
        <Component {...(componentProps as any)} />
      </Suspense>
    </div>
  );
}

/**
 * Hook for preloading components
 * Useful for critical components that should be preloaded on route change
 */
export function usePreloadComponent<T = Record<string, unknown>>(
  importComponent: () => Promise<{ default: ComponentType<T> }>,
): { preload: () => Promise<void>; isPreloaded: boolean } {
  const [isPreloaded, setIsPreloaded] = useState(false);

  const preload = async (): Promise<void> => {
    if (isPreloaded) return;

    try {
      await importComponent();
      setIsPreloaded(true);
    } catch (error) {
      console.error("Failed to preload component:", error);
    }
  };

  return { preload, isPreloaded };
}

/**
 * Higher-order component for creating lazy client islands
 */
export function createLazyClientIsland<T = Record<string, unknown>>(
  importComponent: () => Promise<{ default: ComponentType<T> }>,
  defaultProps?: Partial<LazyClientIslandProps<T>>,
): (props: T & Partial<LazyClientIslandProps<T>>) => JSX.Element {
  return function LazyWrapper(props: T & Partial<LazyClientIslandProps<T>>): JSX.Element {
    const {
      fallback,
      loadImmediately,
      threshold,
      strategy,
      name,
      ...componentProps
    } = props;

    return (
      <LazyClientIsland
        importComponent={importComponent}
        componentProps={componentProps as T}
        fallback={fallback ?? defaultProps?.fallback}
        loadImmediately={loadImmediately ?? defaultProps?.loadImmediately ?? false}
        threshold={threshold ?? defaultProps?.threshold ?? 0.1}
        strategy={strategy ?? defaultProps?.strategy ?? "intersection"}
        name={name ?? defaultProps?.name ?? "LazyComponent"}
      />
    );
  };
}
