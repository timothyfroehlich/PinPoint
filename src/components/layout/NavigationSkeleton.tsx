import { Skeleton } from "~/components/ui/skeleton";
import { Separator } from "~/components/ui/separator";

export function NavigationSkeleton() {
  return (
    <div className="flex flex-col h-full">
      {/* Header skeleton */}
      <div className="p-4 border-b bg-muted/10">
        <Skeleton className="h-6 mb-2" />
        <Skeleton className="h-4 w-3/4" />
      </div>

      <Separator />

      {/* Navigation skeleton */}
      <div className="flex-1 px-4 py-6 space-y-1">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>

      <Separator />

      {/* User menu skeleton */}
      <div className="p-4">
        <div className="flex items-center space-x-3">
          <Skeleton className="w-8 h-8 rounded-full" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-4" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      </div>
    </div>
  );
}
