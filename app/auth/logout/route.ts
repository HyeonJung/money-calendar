import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseAuthServerClient();
  const redirectUrl = new URL("/admin/sync", request.nextUrl.origin);

  if (supabase) {
    await supabase.auth.signOut();
    redirectUrl.searchParams.set("auth", "signed-out");
  } else {
    redirectUrl.searchParams.set("auth", "missing-env");
  }

  return NextResponse.redirect(redirectUrl);
}
