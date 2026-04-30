import "server-only";

import { createClient } from "@supabase/supabase-js";

export type IpoDocument = {
  id: string;
  ipoSlug: string;
  source: string;
  rceptNo: string;
  title: string;
  url: string;
  fetchedAt: string;
};

type IpoDocumentRow = {
  id: string;
  ipo_slug: string;
  source: string;
  rcept_no: string;
  title: string;
  url: string;
  fetched_at: string;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

function createSupabaseServerClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return null;
  }

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function getIpoDocuments(ipoSlug: string) {
  const client = createSupabaseServerClient();

  if (!client) {
    return [];
  }

  const { data, error } = await client
    .from("ipo_documents")
    .select("id, ipo_slug, source, rcept_no, title, url, fetched_at")
    .eq("ipo_slug", ipoSlug)
    .order("fetched_at", { ascending: false });

  if (error) {
    if (
      error.message.includes("ipo_documents") ||
      error.message.includes("schema cache")
    ) {
      return [];
    }

    console.error("[lib/ipo-documents] Failed to fetch IPO documents:", error.message);
    return [];
  }

  return ((data ?? []) as IpoDocumentRow[]).map((row) => ({
    id: row.id,
    ipoSlug: row.ipo_slug,
    source: row.source,
    rceptNo: row.rcept_no,
    title: row.title,
    url: row.url,
    fetchedAt: row.fetched_at,
  }));
}
