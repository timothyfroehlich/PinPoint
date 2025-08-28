import { Skeleton } from "~/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "~/components/ui/card";

export default function IssuesLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <Skeleton className="h-9 w-24" /> {/* "Issues" title */}
          <Skeleton className="h-5 w-48" /> {/* Issue count description */}
        </div>
        <Skeleton className="h-10 w-32" /> {/* Create Issue button */}
      </div>

      {/* Issues list skeleton */}
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-6 w-3/4" /> {/* Issue title */}
                  <Skeleton className="h-4 w-1/2" /> {/* Issue description */}
                </div>
                <div className="flex gap-2 ml-4">
                  <Skeleton className="h-6 w-16" /> {/* Priority badge */}
                  <Skeleton className="h-6 w-20" /> {/* Status badge */}
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-0">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-4 w-32" /> {/* Machine info */}
                  <Skeleton className="h-4 w-24" /> {/* Date info */}
                </div>
                <Skeleton className="h-4 w-20" /> {/* Assignee info */}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
