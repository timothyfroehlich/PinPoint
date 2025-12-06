import { redirect } from "next/navigation";

interface Params {
  initials: string;
}

export default async function MachineIssuesRedirect({
  params,
}: {
  params: Promise<Params>;
}): Promise<never> {
  const { initials } = await params;
  redirect(`/issues?machine=${initials}`);
}
