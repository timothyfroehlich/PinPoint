import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default function QuickReportPage(): never {
  redirect("/report/multiple");
}
