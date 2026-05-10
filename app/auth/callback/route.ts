import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-server";
import { setAdminSessionCookie } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const nextPath = sanitizeNextPath(request.nextUrl.searchParams.get("next"));
  const redirectUrl = new URL(nextPath, request.nextUrl.origin);
  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    redirectUrl.searchParams.set("auth", "missing-code");
    return NextResponse.redirect(redirectUrl);
  }

  const supabase = await createSupabaseAuthServerClient();

  if (!supabase) {
    redirectUrl.searchParams.set("auth", "missing-env");
    return NextResponse.redirect(redirectUrl);
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    redirectUrl.searchParams.set("auth", "callback-error");
  } else {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const email = user?.email?.trim().toLowerCase();

    if (email) {
      await setAdminSessionCookie(email);
      redirectUrl.searchParams.set("auth", "signed-in");
    } else {
      redirectUrl.searchParams.set("auth", "callback-error");
    }
  }

  return NextResponse.redirect(redirectUrl);
}

function sanitizeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/admin/sync";
  }

  return value;
}
