import { redirect } from "next/navigation";
import { machineIssuesHref } from "~/lib/issues/links";

interface Params {
  initials: string;
}

export default async function MachineIssuesRedirect({
  params,
}: {
  params: Promise<Params>;
}): Promise<never> {
  const { initials } = await params;
  redirect(machineIssuesHref(initials));
}
