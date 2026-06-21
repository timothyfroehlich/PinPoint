import { NextResponse } from "next/server";
import { createClient } from "~/lib/supabase/server";
import { getProfileById, getCappedOwnedMachines } from "~/lib/profiles/queries";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  // CORE-SSR-002: createClient → auth.getUser immediately, no logic between.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const profile = await getProfileById(id);
  if (!profile) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const owned = await getCappedOwnedMachines(id);

  // CORE-SEC-007: email must NOT appear in this payload.
  return NextResponse.json({
    name: profile.name,
    avatarUrl: profile.avatarUrl,
    pronouns: profile.pronouns,
    role: profile.role,
    machineCount: owned.total,
  });
}
