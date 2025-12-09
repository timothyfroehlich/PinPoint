import type React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { buildMachineReportUrl } from "~/lib/machines/report-url";
import { generateQrPngDataUrl } from "~/lib/machines/qr";
import { getSiteUrl } from "~/lib/url";

interface MachineForQr {
  id: string;
  initials: string;
  name: string;
}

/**
 * Server component that renders a QR code for reporting this machine.
 */
export async function QrSection({
  machine,
}: {
  machine: MachineForQr;
}): Promise<React.JSX.Element> {
  const reportUrl = buildMachineReportUrl({
    siteUrl: getSiteUrl(),
    machineId: machine.id,
    source: "qr",
  });
  const qrDataUrl = await generateQrPngDataUrl(reportUrl);

  return (
    <Card className="border-outline-variant">
      <CardHeader>
        <CardTitle className="text-2xl text-on-surface">
          Scan to Report
        </CardTitle>
        <p className="text-sm text-on-surface-variant">
          Print and place this QR on {machine.name}. Scans open the public
          report form with this machine preselected by ID.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center justify-center rounded-lg border border-outline-variant bg-surface-variant p-4">
          <img
            src={qrDataUrl}
            alt={`QR code to report an issue for ${machine.name}`}
            className="h-48 w-48"
          />
        </div>
        <div className="flex-1 space-y-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-on-surface-variant">
              Target URL
            </p>
            <p className="break-all rounded-md border border-outline-variant bg-surface px-3 py-2 font-mono text-sm text-on-surface">
              {reportUrl}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              asChild
              className="bg-primary text-on-primary hover:bg-primary/90"
            >
              <a href={qrDataUrl} download={`${machine.initials}-qr.png`}>
                Download PNG
              </a>
            </Button>
            <p className="text-xs text-on-surface-variant">
              PNG is sized for easy printing; replace after reassigning machine
              initials or resetting URLs.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
