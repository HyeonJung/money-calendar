import { timingSafeEqual } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import {
  syncHotDealsFromPublicSources,
  type HotDealSyncResult,
} from "@/lib/hotdeal-sync";
import { recordSyncRun } from "@/lib/sync-runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type ErrorCode = "UNAUTHORIZED" | "SYNC_FAILED";

type ErrorBody = {
  ok: false;
  triggeredAt: string;
  error: {
    code: ErrorCode;
    message: string;
  };
};

const JSON_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
} as const;

function jsonResponse(
  body: ErrorBody | { ok: true; triggeredAt: string; result: HotDealSyncResult },
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

export async function GET(request: NextRequest) {
  const startedAt = new Date();
  const triggeredAt = startedAt.toISOString();
  const cronSecret = process.env.CRON_SECRET?.trim();
  const dryRun = request.nextUrl.searchParams.get("dryRun") === "1";
  const limitParam = Number(request.nextUrl.searchParams.get("limit") ?? 20);
  const limit = Number.isFinite(limitParam)
    ? Math.max(1, Math.min(Math.trunc(limitParam), 50))
    : 20;

  if (!isAuthorized(request, cronSecret)) {
    const finishedAt = new Date();
    await recordSyncRun({
      status: "unauthorized",
      dryRun,
      startedAt,
      finishedAt,
      message: "Invalid cron secret.",
      errorCode: "UNAUTHORIZED",
      triggerType: "cron",
      result: { source: "핫딜 커뮤니티" },
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
    const result = await syncHotDealsFromPublicSources({ dryRun, limit });
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
        triggerType: "cron",
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
      triggerType: "cron",
    });

    return jsonResponse({
      ok: true,
      triggeredAt,
      result,
    });
  } catch (error) {
    console.error("Failed to sync hot deals from public sources.", error);

    const message =
      error instanceof Error ? error.message : "Unknown error while syncing hot deals.";
    const finishedAt = new Date();
    await recordSyncRun({
      status: "failed",
      dryRun,
      startedAt,
      finishedAt,
      message,
      errorCode: "SYNC_FAILED",
      triggerType: "cron",
      result: { source: "핫딜 커뮤니티" },
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
