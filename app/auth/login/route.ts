import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseAuthServerClient();
  const fallbackUrl = new URL("/admin/sync", request.nextUrl.origin);

  if (!supabase) {
    fallbackUrl.searchParams.set("auth", "missing-env");
    return NextResponse.redirect(fallbackUrl);
  }

  const nextPath = sanitizeNextPath(request.nextUrl.searchParams.get("next"));
  const redirectTo = new URL("/auth/callback", request.nextUrl.origin);
  redirectTo.searchParams.set("next", nextPath);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectTo.toString(),
    },
  });

  if (error || !data.url) {
    fallbackUrl.searchParams.set("auth", "login-error");
    return NextResponse.redirect(fallbackUrl);
  }

  return NextResponse.redirect(data.url);
}

function sanitizeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/admin/sync";
  }

  return value;
}
