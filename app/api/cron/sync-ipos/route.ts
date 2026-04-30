import { timingSafeEqual } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  syncIposFromPublicSources,
  type IpoSyncResult,
} from "@/lib/ipo-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type ErrorCode =
  | "UNAUTHORIZED"
  | "SYNC_FAILED";

type ErrorBody = {
  ok: false;
  triggeredAt: string;
  error: {
    code: ErrorCode;
    message: string;
  };
};

type SyncRunStatus = "success" | "failed" | "unauthorized";

type RecordSyncRunInput = {
  status: SyncRunStatus;
  dryRun: boolean;
  startedAt: Date;
  finishedAt: Date;
  message: string;
  result?: IpoSyncResult;
  errorCode?: ErrorCode;
};

const JSON_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
} as const;

function jsonResponse(
  body: ErrorBody | { ok: true; triggeredAt: string; result: IpoSyncResult },
  status = 200,
) {
  return NextResponse.json(body, {
    status,
    headers: JSON_HEADERS,
  });
}

function isAuthorized(request: NextRequest, cronSecret: string | undefined) {
  if (!cronSecret) {
    return true;
  }

  const authorization = request.headers.get("authorization");
  const bearerToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;
  const queryToken = request.nextUrl.searchParams.get("secret");
  const providedSecret = bearerToken ?? queryToken;

  if (!providedSecret) {
    return false;
  }

  const expected = Buffer.from(cronSecret);
  const actual = Buffer.from(providedSecret);

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

async function recordSyncRun({
  status,
  dryRun,
  startedAt,
  finishedAt,
  message,
  result,
  errorCode,
}: RecordSyncRunInput) {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ??
    process.env.SUPABASE_URL?.trim() ??
    "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

  if (!supabaseUrl || !serviceRoleKey) {
    return;
  }

  try {
    const client = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    const { error } = await client.from("sync_runs").insert({
      source: result?.source ?? "cron",
      status,
      dry_run: dryRun,
      started_at: startedAt.toISOString(),
      finished_at: finishedAt.toISOString(),
      duration_ms: finishedAt.getTime() - startedAt.getTime(),
      message,
      error_code: errorCode ?? null,
      counts: result?.counts ?? null,
      warnings: result?.warnings ?? [],
      errors: result?.errors ?? [],
    });

    if (error) {
      console.warn("[api/cron/sync-ipos] Failed to record sync run:", error.message);
    }
  } catch (error) {
    console.warn("[api/cron/sync-ipos] Failed to record sync run:", error);
  }
}

export async function GET(request: NextRequest) {
  const startedAt = new Date();
  const triggeredAt = startedAt.toISOString();
  const cronSecret = process.env.CRON_SECRET?.trim();
  const dryRun = request.nextUrl.searchParams.get("dryRun") === "1";

  if (!isAuthorized(request, cronSecret)) {
    const finishedAt = new Date();
    await recordSyncRun({
      status: "unauthorized",
      dryRun,
      startedAt,
      finishedAt,
      message: "Invalid cron secret.",
      errorCode: "UNAUTHORIZED",
    });

    return jsonResponse(
      {
        ok: false,
        triggeredAt,
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid cron secret.",
        },
      },
      401,
    );
  }

  try {
    const result = await syncIposFromPublicSources({ dryRun });
    const finishedAt = new Date();

    if (!result.ok) {
      await recordSyncRun({
        status: "failed",
        dryRun,
        startedAt,
        finishedAt,
        message: result.message,
        result,
        errorCode: "SYNC_FAILED",
      });

      return jsonResponse(
        {
          ok: false,
          triggeredAt,
          error: {
            code: "SYNC_FAILED",
            message: result.message,
          },
        },
        502,
      );
    }

    await recordSyncRun({
      status: "success",
      dryRun,
      startedAt,
      finishedAt,
      message: result.message,
      result,
    });

    return jsonResponse({
      ok: true,
      triggeredAt,
      result,
    });
  } catch (error) {
    console.error("Failed to sync IPO data from public sources.", error);

    const message =
      error instanceof Error ? error.message : "Unknown error while syncing IPO data.";
    const finishedAt = new Date();
    await recordSyncRun({
      status: "failed",
      dryRun,
      startedAt,
      finishedAt,
      message,
      errorCode: "SYNC_FAILED",
    });

    return jsonResponse(
      {
        ok: false,
        triggeredAt,
        error: {
          code: "SYNC_FAILED",
          message,
        },
      },
      500,
    );
  }
}
