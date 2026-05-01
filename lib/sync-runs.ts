import "server-only";

import { createSupabaseServiceRoleClient } from "./supabase-server";

export type SyncRunStatus = "success" | "failed" | "unauthorized";
export type SyncRunTriggerType = "cron" | "manual";

export type SyncRun = {
  id: string;
  source: string;
  status: SyncRunStatus;
  triggerType: SyncRunTriggerType;
  dryRun: boolean;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  message: string;
  errorCode: string | null;
  actorEmail: string | null;
  counts: Record<string, unknown> | null;
  warnings: string[];
  errors: string[];
  createdAt: string;
};

export type SyncRunDashboard =
  | {
      ok: true;
      runs: SyncRun[];
      stats: {
        latest: SyncRun | null;
        lastSuccess: SyncRun | null;
        lastFailure: SyncRun | null;
        recentAverageDurationMs: number | null;
      };
    }
  | {
      ok: false;
      reason: "missing-env" | "schema-required" | "query-failed";
      message: string;
      runs: [];
      stats: {
        latest: null;
        lastSuccess: null;
        lastFailure: null;
        recentAverageDurationMs: null;
      };
    };

export type SyncRunLogResult = {
  source?: string;
  counts?: Record<string, unknown>;
  warnings?: string[];
  errors?: string[];
};

type SyncRunRow = {
  id: string;
  source: string | null;
  status: SyncRunStatus | null;
  trigger_type?: SyncRunTriggerType | null;
  dry_run: boolean | null;
  started_at: string;
  finished_at: string;
  duration_ms: number | null;
  message: string | null;
  error_code: string | null;
  actor_email?: string | null;
  counts: Record<string, unknown> | null;
  warnings: string[] | null;
  errors: string[] | null;
  created_at: string;
};

export type RecordSyncRunInput = {
  status: SyncRunStatus;
  dryRun: boolean;
  startedAt: Date;
  finishedAt: Date;
  message: string;
  result?: SyncRunLogResult;
  errorCode?: string | null;
  triggerType: SyncRunTriggerType;
  actorEmail?: string | null;
};

const EMPTY_DASHBOARD_STATS = {
  latest: null,
  lastSuccess: null,
  lastFailure: null,
  recentAverageDurationMs: null,
} as const;

export async function getSyncRunDashboard(limit = 30): Promise<SyncRunDashboard> {
  const client = createSupabaseServiceRoleClient();

  if (!client) {
    return {
      ok: false,
      reason: "missing-env",
      message: "SUPABASE_SERVICE_ROLE_KEY가 없어 동기화 이력을 조회할 수 없습니다.",
      runs: [],
      stats: EMPTY_DASHBOARD_STATS,
    };
  }

  const { data, error } = await client
    .from("sync_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) {
    const reason =
      error.message.includes("sync_runs") || error.message.includes("schema cache")
        ? "schema-required"
        : "query-failed";

    return {
      ok: false,
      reason,
      message:
        reason === "schema-required"
          ? "sync_runs 테이블 또는 운영 추적 컬럼이 아직 DB에 적용되지 않았습니다."
          : `동기화 이력을 조회하지 못했습니다: ${error.message}`,
      runs: [],
      stats: EMPTY_DASHBOARD_STATS,
    };
  }

  const runs = ((data ?? []) as SyncRunRow[]).map(mapSyncRunRow);
  const recentDurations = runs
    .slice(0, 10)
    .map((run) => run.durationMs)
    .filter((value) => Number.isFinite(value) && value >= 0);

  return {
    ok: true,
    runs,
    stats: {
      latest: runs[0] ?? null,
      lastSuccess: runs.find((run) => run.status === "success") ?? null,
      lastFailure: runs.find((run) => run.status === "failed") ?? null,
      recentAverageDurationMs:
        recentDurations.length > 0
          ? Math.round(
              recentDurations.reduce((total, value) => total + value, 0) /
                recentDurations.length,
            )
          : null,
    },
  };
}

export async function recordSyncRun({
  status,
  dryRun,
  startedAt,
  finishedAt,
  message,
  result,
  errorCode,
  triggerType,
  actorEmail,
}: RecordSyncRunInput) {
  const client = createSupabaseServiceRoleClient();

  if (!client) {
    return {
      ok: false,
      message: "SUPABASE_SERVICE_ROLE_KEY가 없어 동기화 실행 로그를 저장하지 못했습니다.",
    };
  }

  try {
    const { error } = await client.from("sync_runs").insert({
      source: result?.source ?? "cron",
      status,
      trigger_type: triggerType,
      dry_run: dryRun,
      started_at: startedAt.toISOString(),
      finished_at: finishedAt.toISOString(),
      duration_ms: finishedAt.getTime() - startedAt.getTime(),
      message,
      error_code: errorCode ?? null,
      actor_email: actorEmail ?? null,
      counts: result?.counts ?? null,
      warnings: result?.warnings ?? [],
      errors: result?.errors ?? [],
    });

    if (error) {
      return {
        ok: false,
        message: error.message,
      };
    }

    return {
      ok: true,
      message: "동기화 실행 로그를 저장했습니다.",
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unknown sync run logging error.",
    };
  }
}

function mapSyncRunRow(row: SyncRunRow): SyncRun {
  return {
    id: row.id,
    source: row.source ?? "cron",
    status: row.status ?? "failed",
    triggerType: row.trigger_type ?? "cron",
    dryRun: Boolean(row.dry_run),
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    durationMs: row.duration_ms ?? 0,
    message: row.message ?? "",
    errorCode: row.error_code,
    actorEmail: row.actor_email ?? null,
    counts: row.counts,
    warnings: row.warnings ?? [],
    errors: row.errors ?? [],
    createdAt: row.created_at,
  };
}
