import { Skeleton } from "~/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

export default function IssueDetailLoading() {
  return (
    <div className="container mx-auto px-4 py-6">
      <div className="space-y-6">
        {/* Issue Header skeleton */}
        <div className="flex justify-between items-start">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-9 w-3/4" /> {/* Issue title */}
            <div className="flex items-center gap-4">
              <Skeleton className="h-4 w-24" /> {/* Issue ID */}
              <Skeleton className="h-4 w-32" /> {/* Created date */}
              <Skeleton className="h-4 w-20" /> {/* Created by */}
            </div>
          </div>

          <div className="flex gap-2">
            <Skeleton className="h-6 w-20" /> {/* Priority badge */}
            <Skeleton className="h-6 w-16" /> {/* Status badge */}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content skeleton */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description skeleton */}
            <Card>
              <CardHeader>
                <CardTitle>
                  <Skeleton className="h-5 w-24" />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-3/5" />
              </CardContent>
            </Card>

            {/* Comments skeleton */}
            <Card>
              <CardHeader>
                <CardTitle>
                  <Skeleton className="h-5 w-20" />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-4 w-48" />

                {/* Comment form skeleton */}
                <div className="mt-6 pt-4 border-t space-y-4">
                  <Skeleton className="h-24 w-full" /> {/* Textarea */}
                  <div className="flex justify-end">
                    <Skeleton className="h-9 w-24" /> {/* Button */}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar skeleton */}
          <div className="space-y-4">
            {/* Machine info skeleton */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Skeleton className="h-5 w-5" />
                  <Skeleton className="h-5 w-16" />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-28" />
              </CardContent>
            </Card>

            {/* Assignment skeleton */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Skeleton className="h-5 w-5" />
                  <Skeleton className="h-5 w-20" />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div>
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
                <Skeleton className="h-9 w-full" /> {/* Assignment select */}
                <Skeleton className="h-8 w-full" /> {/* Update button */}
              </CardContent>
            </Card>

            {/* Status skeleton */}
            <Card>
              <CardHeader>
                <CardTitle>
                  <Skeleton className="h-5 w-12" />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-6 w-16" />
                </div>
                <Skeleton className="h-9 w-full" /> {/* Status select */}
                <Skeleton className="h-8 w-full" /> {/* Update button */}
              </CardContent>
            </Card>

            {/* Timeline skeleton */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Skeleton className="h-5 w-5" />
                  <Skeleton className="h-5 w-16" />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
