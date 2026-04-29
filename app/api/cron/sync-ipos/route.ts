import { timingSafeEqual } from "node:crypto";

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

export async function GET(request: NextRequest) {
  const triggeredAt = new Date().toISOString();
  const cronSecret = process.env.CRON_SECRET?.trim();
  

  if (!isAuthorized(request, cronSecret)) {
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
    const dryRun = request.nextUrl.searchParams.get("dryRun") === "1";
    const result = await syncIposFromPublicSources({ dryRun });

    if (!result.ok) {
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

    return jsonResponse({
      ok: true,
      triggeredAt,
      result,
    });
  } catch (error) {
    console.error("Failed to sync IPO data from public sources.", error);

    const message =
      error instanceof Error ? error.message : "Unknown error while syncing IPO data.";

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
