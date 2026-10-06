import type React from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ApronBatchPrint } from "~/components/machines/apron/ApronBatchPrint";
import { Forbidden } from "~/components/errors/Forbidden";
import { PageContainer } from "~/components/layout/PageContainer";
import { getViewer } from "~/lib/collections/viewer";
import { buildMachineHubUrl } from "~/lib/machines/hub-url";
import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";
import { getLoginUrl, resolveRequestUrl } from "~/lib/url";
import { getPrintableApronCards, getQueuedApronCardIds } from "./_data";

export const metadata: Metadata = { title: "Print apron cards" };

/**
 * Print apron cards (spec apron-cards §12): pick saved cards across machines
 * and download one print file per apron size for a print shop, plus an order
 * sheet. Members only, the same gate as exporting one card (§12.1, §9.3).
 */
export default async function PrintApronCardsPage(): Promise<React.JSX.Element> {
  const viewer = await getViewer();
  if (viewer.userId === undefined) redirect(getLoginUrl("/m/apron-cards"));
  if (!checkPermission("machines.apron.export", getAccessLevel(viewer.role))) {
    return <Forbidden role={viewer.role} backUrl="/m" />;
  }

  const [cards, queuedIds, requestHeaders] = await Promise.all([
    getPrintableApronCards(),
    getQueuedApronCardIds(viewer.userId),
    headers(),
  ]);
  const siteUrl = resolveRequestUrl(requestHeaders);

  return (
    <PageContainer size="wide">
      <ApronBatchPrint
        cards={cards.map((card) => ({
          ...card,
          scanUrl: buildMachineHubUrl(siteUrl, card.machineInitials),
        }))}
        queuedIds={queuedIds}
      />
    </PageContainer>
  );
}
