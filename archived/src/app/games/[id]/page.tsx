import { redirect } from "next/navigation";

interface GamePageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function GamePage({
  params,
}: GamePageProps): Promise<never> {
  const resolvedParams = await params;
  redirect(`/machines/${resolvedParams.id}`);
}
