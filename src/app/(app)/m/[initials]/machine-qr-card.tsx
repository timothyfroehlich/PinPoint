import type React from "react";
import { Download, QrCode } from "lucide-react";

import { Button } from "~/components/ui/button";
import { CopyButton } from "~/components/ui/copy-button";

const LABEL =
  "text-[10px] font-bold uppercase tracking-wider text-muted-foreground";

interface MachineQrCardProps {
  machineName: string;
  machineInitials: string;
  /** Pre-rendered PNG data URL (from `generateQrPngDataUrl`). */
  qrDataUrl: string;
  /** The absolute hub URL the QR encodes (also the copy target). */
  hubUrl: string;
}

/**
 * QR code card — the Service tab's printable sticker (design §4). Shows the
 * code inline (relocated off the Info tab's header/tools block) with Download
 * and copy-link actions. Horizontal layout (code + caption side by side) so it
 * stays compact in the 320px rail and on mobile alike.
 */
export function MachineQrCard({
  machineName,
  machineInitials,
  qrDataUrl,
  hubUrl,
}: MachineQrCardProps): React.JSX.Element {
  return (
    <section
      className="rounded-xl border border-outline-variant bg-card p-4"
      data-testid="machine-qr-card"
      aria-labelledby="machine-qr-heading"
    >
      <h2
        id="machine-qr-heading"
        className={`mb-3 flex items-center gap-2 ${LABEL}`}
      >
        <QrCode className="size-3.5 text-primary" aria-hidden="true" />
        QR code
      </h2>

      <div className="flex items-center gap-4">
        <div className="shrink-0 rounded-lg border border-outline-variant/60 bg-white p-2 shadow-sm">
          <img
            src={qrDataUrl}
            alt={`QR code linking to the machine hub for ${machineName}`}
            className="size-24"
          />
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-xs text-muted-foreground">
            Scan to post a score or report a problem for this machine.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <a href={qrDataUrl} download={`${machineInitials}-qr.png`}>
                <Download className="size-4" aria-hidden="true" />
                Download
              </a>
            </Button>
            <CopyButton
              value={hubUrl}
              variant="ghost"
              size="sm"
              aria-label="Copy machine hub link"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
