import type React from "react";
import { CopyButton } from "~/components/ui/copy-button";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { buildMachineReportUrl } from "~/lib/machines/report-url";
import { generateQrPngDataUrl } from "~/lib/machines/qr";
import { getSiteUrl } from "~/lib/url";
import { Printer, ExternalLink, Download } from "lucide-react";

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
    machineInitials: machine.initials,
    source: "qr",
  });
  const qrDataUrl = await generateQrPngDataUrl(reportUrl);

  return (
    <Card className="border-outline-variant overflow-hidden">
      <CardContent className="p-0">
        <div className="flex flex-col sm:flex-row">
          {/* Left: QR Visual */}
          <div className="flex flex-col items-center justify-center bg-surface-variant/30 p-6 sm:w-48 sm:border-r border-outline-variant">
            <div className="bg-white p-2 rounded-lg shadow-xs mb-3">
              <img
                src={qrDataUrl}
                alt={`QR code for ${machine.name}`}
                className="size-32"
              />
            </div>
            <p className="text-[10px] font-medium text-on-surface-variant uppercase tracking-wider">
              Scan to Report
            </p>
          </div>

          {/* Right: Actions */}
          <div className="flex-1 p-6 flex flex-col justify-between gap-4">
            <div>
              <h3 className="font-semibold text-on-surface text-lg mb-1">
                Machine Identity
              </h3>
              <p className="text-sm text-on-surface-variant">
                Print and attach this code to {machine.name}. Players can scan
                it to instantly report issues with this machine pre-selected.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  className="flex-1 justify-start"
                  asChild
                >
                  <a href={qrDataUrl} download={`${machine.initials}-qr.png`}>
                    <Download className="mr-2 size-4" />
                    Download PNG
                  </a>
                </Button>
                <div className="flex gap-2">
                  <CopyButton
                    value={reportUrl}
                    variant="outline"
                    className="border-outline-variant"
                  />
                  <Button variant="ghost" size="icon" asChild title="Test Link">
                    <a
                      href={reportUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="size-4 text-on-surface-variant" />
                    </a>
                  </Button>
                </div>
              </div>
              <p className="text-xs text-on-surface-variant/70 flex items-center gap-1.5">
                <Printer className="size-3" />
                <span>Optimized for standard label printers</span>
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
