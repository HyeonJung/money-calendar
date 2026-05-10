import { NextResponse } from "next/server";
import { setAdminSessionCookie } from "@/lib/admin-auth";
import { createSupabaseAuthServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAPAAAP///wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==",
  "base64",
);

export async function GET() {
  const supabase = await createSupabaseAuthServerClient();

  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const email = user?.email?.trim().toLowerCase();

    if (email) {
      await setAdminSessionCookie(email);
    }
  }

  return new NextResponse(TRANSPARENT_GIF, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "image/gif",
    },
  });
}
