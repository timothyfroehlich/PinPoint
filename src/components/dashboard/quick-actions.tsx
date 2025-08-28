import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  PlusIcon,
  WrenchIcon,
  QrCodeIcon,
  SearchIcon,
  BarChart3Icon,
  SettingsIcon,
} from "lucide-react";

export function QuickActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Button
            variant="outline"
            asChild
            className="h-auto p-4 flex-col gap-2"
          >
            <Link href="/issues/create">
              <PlusIcon className="h-5 w-5" />
              <span className="text-xs">Create Issue</span>
            </Link>
          </Button>

          <Button
            variant="outline"
            asChild
            className="h-auto p-4 flex-col gap-2"
          >
            <Link href="/machines">
              <WrenchIcon className="h-5 w-5" />
              <span className="text-xs">View Machines</span>
            </Link>
          </Button>

          <Button
            variant="outline"
            asChild
            className="h-auto p-4 flex-col gap-2"
          >
            <Link href="/qr-codes">
              <QrCodeIcon className="h-5 w-5" />
              <span className="text-xs">QR Codes</span>
            </Link>
          </Button>

          <Button
            variant="outline"
            asChild
            className="h-auto p-4 flex-col gap-2"
          >
            <Link href="/issues?status=open">
              <SearchIcon className="h-5 w-5" />
              <span className="text-xs">Search Issues</span>
            </Link>
          </Button>

          <Button
            variant="outline"
            asChild
            className="h-auto p-4 flex-col gap-2"
          >
            <Link href="/analytics">
              <BarChart3Icon className="h-5 w-5" />
              <span className="text-xs">Analytics</span>
            </Link>
          </Button>

          <Button
            variant="outline"
            asChild
            className="h-auto p-4 flex-col gap-2"
          >
            <Link href="/settings">
              <SettingsIcon className="h-5 w-5" />
              <span className="text-xs">Settings</span>
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
