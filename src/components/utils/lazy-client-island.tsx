/**
 * Lazy Client Island Wrapper
 * Phase 3D: Dynamic imports for non-critical client islands
 * Reduces initial bundle size and improves performance
 */

"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { type ComponentType } from "react";
import { isDevelopment } from "~/lib/environment-client";
import { isError } from "~/lib/utils/type-guards";

interface LazyClientIslandProps<T extends Record<string, unknown> = Record<string, unknown>> {
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
export function LazyClientIsland<T extends Record<string, unknown> = Record<string, unknown>>({
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
      if (isDevelopment()) {
        console.log(`✅ Lazy loaded client island: ${name}`);
      }
    } catch (err) {
      const error = isError(err) ? err : new Error("Failed to load component");
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
        <Component {...componentProps} />
      </Suspense>
    </div>
  );
}

/**
 * Hook for preloading components
 * Useful for critical components that should be preloaded on route change
 */
export function usePreloadComponent<T extends Record<string, unknown> = Record<string, unknown>>(
  importComponent: () => Promise<{ default: ComponentType<T> }>,
): { preload: () => Promise<void>; isPreloaded: boolean } {
  const [isPreloaded, setIsPreloaded] = useState(false);

  const preload = async (): Promise<void> => {
    if (isPreloaded) return;

    try {
      await importComponent();
      setIsPreloaded(true);
    } catch (err) {
      console.error("Failed to preload component:", isError(err) ? err.message : String(err));
    }
  };

  return { preload, isPreloaded };
}

/**
 * Higher-order component for creating lazy client islands
 */
export function createLazyClientIsland<T extends Record<string, unknown>>(
  importComponent: () => Promise<{ default: ComponentType<T> }>,
  defaultProps?: Partial<LazyClientIslandProps<T>>,
): (props: T & Partial<LazyClientIslandProps<T>>) => JSX.Element {
  return function LazyWrapper(props: T & Partial<LazyClientIslandProps<T>>): JSX.Element {
    // Extract LazyClientIslandProps from the combined props
    const lazyProps: Partial<LazyClientIslandProps<T>> = {
      ...(props.fallback !== undefined && { fallback: props.fallback }),
      ...(props.loadImmediately !== undefined && { loadImmediately: props.loadImmediately }),
      ...(props.threshold !== undefined && { threshold: props.threshold }),
      ...(props.strategy !== undefined && { strategy: props.strategy }),
      ...(props.name !== undefined && { name: props.name }),
    };

    // Create componentProps by excluding LazyClientIslandProps keys
    const componentProps = Object.keys(props).reduce((acc, key) => {
      if (!['fallback', 'loadImmediately', 'threshold', 'strategy', 'name'].includes(key)) {
        (acc as Record<string, unknown>)[key] = props[key as keyof typeof props];
      }
      return acc;
    }, {} as T);

    return (
      <LazyClientIsland
        importComponent={importComponent}
        componentProps={componentProps}
        fallback={lazyProps.fallback ?? defaultProps?.fallback}
        loadImmediately={lazyProps.loadImmediately ?? defaultProps?.loadImmediately ?? false}
        threshold={lazyProps.threshold ?? defaultProps?.threshold ?? 0.1}
        strategy={lazyProps.strategy ?? defaultProps?.strategy ?? "intersection"}
        name={lazyProps.name ?? defaultProps?.name ?? "LazyComponent"}
      />
    );
  };
}
