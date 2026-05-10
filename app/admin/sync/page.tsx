import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Database,
  LogIn,
  Play,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import {
  createAdminActionToken,
  getAdminAccess,
  getAdminAccessFromActionToken,
  type AdminAccess,
} from "@/lib/admin-auth";
import { syncHotDealsFromPublicSources } from "@/lib/hotdeal-sync";
import { syncIposFromPublicSources } from "@/lib/ipo-sync";
import {
  getSyncRunDashboard,
  recordSyncRun,
  type SyncRun,
  type SyncRunDashboard,
  type SyncRunStatus,
  type SyncRunTriggerType,
} from "@/lib/sync-runs";

type AdminSyncPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type ManualSyncSource = "ipos" | "hotdeals";

export const metadata: Metadata = {
  title: "동기화 상태 | 운영자 | 머니캘린더",
  description: "공모주와 핫딜 데이터 동기화 실행 이력과 수동 실행 상태를 확인합니다.",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminSyncPage({ searchParams }: AdminSyncPageProps) {
  const params = searchParams ? await searchParams : {};
  const access = await getAdminAccess();

  if (access.state === "anonymous" || access.state === "missing-env") {
    return (
      <AdminShell access={access}>
        <LoginRequired access={access} authNotice={getParam(params, "auth")} />
      </AdminShell>
    );
  }

  if (access.state === "setup-required" || access.state === "forbidden") {
    return (
      <AdminShell access={access}>
        <AccessBlocked access={access} authNotice={getParam(params, "auth")} />
      </AdminShell>
    );
  }

  const dashboard = await getSyncRunDashboard(30);

  return (
    <AdminShell access={access}>
      <ActionNotice
        value={getParam(params, "run")}
        dryRun={getParam(params, "dryRun")}
        source={readManualSyncSource(getParam(params, "source"))}
      />
      <AdminHero access={access} dashboard={dashboard} />

      {dashboard.ok ? (
        <>
          <SyncActionPanel access={access} />
          <SyncRunsTable runs={dashboard.runs} />
        </>
      ) : (
        <SchemaRequiredPanel dashboard={dashboard} />
      )}
    </AdminShell>
  );
}

async function runManualSyncAction(formData: FormData) {
  "use server";

  let access = await getAdminAccess();
  const dryRun = formData.get("dryRun") === "1";
  const source = readManualSyncSource(formData.get("source"));
  const actionToken = String(formData.get("adminActionToken") ?? "");

  if (access.state !== "authorized") {
    access = await getAdminAccessFromActionToken(actionToken);
  }

  if (access.state !== "authorized") {
    redirect(
      `/admin/sync?run=${getManualSyncDeniedCode(access)}&dryRun=${
        dryRun ? "1" : "0"
      }&source=${source}`,
    );
  }

  if (!access.canRunSync) {
    redirect(`/admin/sync?run=viewer-forbidden&dryRun=${dryRun ? "1" : "0"}&source=${source}`);
  }

  const startedAt = new Date();
  let redirectPath = `/admin/sync?run=failed&dryRun=${dryRun ? "1" : "0"}&source=${source}`;

  try {
    const result =
      source === "hotdeals"
        ? await syncHotDealsFromPublicSources({ dryRun })
        : await syncIposFromPublicSources({ dryRun });
    const finishedAt = new Date();
    await recordSyncRun({
      status: result.ok ? "success" : "failed",
      dryRun: result.dryRun,
      startedAt,
      finishedAt,
      message: result.message,
      result,
      errorCode: result.ok ? null : "SYNC_FAILED",
      triggerType: "manual",
      actorEmail: access.user.email,
    });

    redirectPath = `/admin/sync?run=${result.ok ? "success" : "failed"}&dryRun=${
      result.dryRun ? "1" : "0"
    }&source=${source}`;
  } catch (error) {
    const finishedAt = new Date();
    const message =
      error instanceof Error
        ? error.message
        : `Unknown error while syncing ${getManualSyncSourceLabel(source)} data.`;

    await recordSyncRun({
      status: "failed",
      dryRun,
      startedAt,
      finishedAt,
      message,
      errorCode: "SYNC_FAILED",
      triggerType: "manual",
      actorEmail: access.user.email,
    });
  }

  revalidatePath("/admin/sync");
  redirect(redirectPath);
}

function AdminShell({
  access,
  children,
}: {
  access: AdminAccess;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {access.user ? (
        // Existing Supabase sessions are backfilled into the app admin session
        // cookie so Server Actions can keep authorization stable.
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/auth/session/refresh" alt="" aria-hidden="true" className="hidden" />
        </>
      ) : null}
      <div className="mb-6 flex flex-col gap-3 border-b border-neutral-200 pb-5 dark:border-neutral-800 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            운영자
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal text-neutral-950 dark:text-white">
            동기화 상태
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin"
            className="inline-flex h-9 items-center rounded-md border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-50 hover:text-neutral-950 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:border-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-white"
          >
            핫딜 관리
          </Link>
          {access.user ? (
            <span className="inline-flex h-9 items-center rounded-md border border-neutral-200 bg-white px-3 text-sm font-semibold text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
              {access.user.email}
            </span>
          ) : null}
          {access.state === "authorized" ? (
            <span className="inline-flex h-9 items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/60 dark:text-emerald-300">
              {access.role}
            </span>
          ) : null}
          {access.user ? (
            <Link
              href="/auth/logout"
              className="inline-flex h-9 items-center rounded-md border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-50 hover:text-neutral-950 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:border-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-white"
            >
              로그아웃
            </Link>
          ) : null}
        </div>
      </div>
      {children}
    </main>
  );
}

function LoginRequired({
  access,
  authNotice,
}: {
  access: Extract<AdminAccess, { state: "anonymous" | "missing-env" }>;
  authNotice?: string;
}) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm shadow-black/5 dark:border-neutral-800 dark:bg-neutral-950 dark:shadow-none">
      <div className="flex items-start gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
          <LogIn size={20} aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-neutral-950 dark:text-white">
            Google 로그인이 필요합니다
          </h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
            {access.message}
          </p>
          {authNotice ? <AuthNotice value={authNotice} /> : null}
          {access.state === "missing-env" ? (
            <SetupHint />
          ) : (
            <Link
              href={`/auth/login?next=${encodeURIComponent("/admin/sync")}`}
              className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              <LogIn size={16} aria-hidden="true" />
              Google로 로그인
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

function AccessBlocked({
  access,
  authNotice,
}: {
  access: Extract<AdminAccess, { state: "setup-required" | "forbidden" }>;
  authNotice?: string;
}) {
  const isSetupIssue = access.state === "setup-required";

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm shadow-black/5 dark:border-neutral-800 dark:bg-neutral-950 dark:shadow-none">
      <div className="flex items-start gap-3">
        <span
          className={[
            "inline-flex size-10 shrink-0 items-center justify-center rounded-lg",
            isSetupIssue
              ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
              : "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
          ].join(" ")}
        >
          {isSetupIssue ? (
            <ShieldAlert size={20} aria-hidden="true" />
          ) : (
            <AlertCircle size={20} aria-hidden="true" />
          )}
        </span>
        <div>
          <h2 className="text-lg font-semibold text-neutral-950 dark:text-white">
            {isSetupIssue ? "운영자 권한 설정 필요" : "접근 권한 없음"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
            {access.message}
          </p>
          {authNotice ? <AuthNotice value={authNotice} /> : null}
          {isSetupIssue ? <SetupHint /> : null}
        </div>
      </div>
    </section>
  );
}

function AdminHero({
  access,
  dashboard,
}: {
  access: Extract<AdminAccess, { state: "authorized" }>;
  dashboard: SyncRunDashboard;
}) {
  if (!dashboard.ok) {
    return (
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/70 dark:bg-amber-950/30">
        <div className="flex items-start gap-3">
          <Database size={20} aria-hidden="true" className="mt-0.5 text-amber-700 dark:text-amber-300" />
          <div>
            <h2 className="text-lg font-semibold text-amber-950 dark:text-amber-100">
              동기화 이력을 불러올 수 없습니다
            </h2>
            <p className="mt-2 text-sm leading-6 text-amber-800 dark:text-amber-200">
              {dashboard.message}
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatusMetric
        icon={<RefreshCw size={18} aria-hidden="true" />}
        label="최근 실행"
        value={dashboard.stats.latest ? getStatusLabel(dashboard.stats.latest.status) : "이력 없음"}
        detail={dashboard.stats.latest ? formatDateTime(dashboard.stats.latest.startedAt) : access.role}
        tone={dashboard.stats.latest ? getStatusTone(dashboard.stats.latest.status) : "neutral"}
      />
      <StatusMetric
        icon={<CheckCircle2 size={18} aria-hidden="true" />}
        label="마지막 성공"
        value={dashboard.stats.lastSuccess ? formatDateTime(dashboard.stats.lastSuccess.startedAt) : "없음"}
        detail={dashboard.stats.lastSuccess?.message ?? "성공 이력이 없습니다."}
        tone="success"
      />
      <StatusMetric
        icon={<AlertCircle size={18} aria-hidden="true" />}
        label="마지막 실패"
        value={dashboard.stats.lastFailure ? formatDateTime(dashboard.stats.lastFailure.startedAt) : "없음"}
        detail={dashboard.stats.lastFailure?.message ?? "실패 이력이 없습니다."}
        tone="failed"
      />
      <StatusMetric
        icon={<Clock3 size={18} aria-hidden="true" />}
        label="최근 10회 평균"
        value={formatDuration(dashboard.stats.recentAverageDurationMs)}
        detail={`${dashboard.runs.length.toLocaleString("ko-KR")}개 이력 표시`}
        tone="neutral"
      />
    </section>
  );
}

function SyncActionPanel({
  access,
}: {
  access: Extract<AdminAccess, { state: "authorized" }>;
}) {
  const actionToken = createAdminActionToken(access.user.email);

  return (
    <section className="mt-5 rounded-lg border border-neutral-200 bg-white p-5 shadow-sm shadow-black/5 dark:border-neutral-800 dark:bg-neutral-950 dark:shadow-none">
      <div>
        <div>
          <h2 className="text-lg font-semibold text-neutral-950 dark:text-white">수동 동기화</h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {access.canRunSync
              ? "공모주와 핫딜을 각각 Dry run으로 점검하거나 실제 DB 저장을 실행할 수 있습니다."
              : "viewer 권한은 이력 조회만 가능합니다."}
          </p>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <ManualSyncCard
            source="ipos"
            title="공모주 동기화"
            description="공모주 일정, 상세 정보, 상태를 공개 소스 기준으로 갱신합니다."
            canRunSync={access.canRunSync}
            actionToken={actionToken}
          />
          <ManualSyncCard
            source="hotdeals"
            title="핫딜 동기화"
            description="등록 1시간 이내 핫딜만 수집하고 같은 상품 주소는 건너뜁니다."
            canRunSync={access.canRunSync}
            actionToken={actionToken}
          />
        </div>
      </div>
    </section>
  );
}

function ManualSyncCard({
  source,
  title,
  description,
  canRunSync,
  actionToken,
}: {
  source: ManualSyncSource;
  title: string;
  description: string;
  canRunSync: boolean;
  actionToken: string;
}) {
  return (
    <article className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
      <div className="flex items-start gap-3">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
          <Database size={17} aria-hidden="true" />
        </span>
        <div>
          <h3 className="text-base font-semibold text-neutral-950 dark:text-white">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
            {description}
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <form action={runManualSyncAction}>
          <input type="hidden" name="source" value={source} />
          <input type="hidden" name="dryRun" value="1" />
          <input type="hidden" name="adminActionToken" value={actionToken} />
          <button
            type="submit"
            disabled={!canRunSync}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:bg-neutral-800"
          >
            <RefreshCw size={16} aria-hidden="true" />
            Dry run
          </button>
        </form>
        <form action={runManualSyncAction}>
          <input type="hidden" name="source" value={source} />
          <input type="hidden" name="dryRun" value="0" />
          <input type="hidden" name="adminActionToken" value={actionToken} />
          <button
            type="submit"
            disabled={!canRunSync}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Play size={16} aria-hidden="true" />
            실제 동기화
          </button>
        </form>
      </div>
    </article>
  );
}

function SyncRunsTable({ runs }: { runs: SyncRun[] }) {
  return (
    <section className="mt-5 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm shadow-black/5 dark:border-neutral-800 dark:bg-neutral-950 dark:shadow-none">
      <div className="border-b border-neutral-200 px-4 py-4 dark:border-neutral-800 sm:px-5">
        <h2 className="text-lg font-semibold text-neutral-950 dark:text-white">실행 이력</h2>
      </div>
      {runs.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-[1080px] divide-y divide-neutral-200 text-left dark:divide-neutral-800">
            <thead className="bg-neutral-50 dark:bg-neutral-900">
              <tr className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                <th className="px-4 py-3">시작 시각</th>
                <th className="px-4 py-3">상태</th>
                <th className="px-4 py-3">실행</th>
                <th className="px-4 py-3">소스</th>
                <th className="px-4 py-3">소요</th>
                <th className="px-4 py-3">건수</th>
                <th className="px-4 py-3">메시지</th>
                <th className="px-4 py-3">상세</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {runs.map((run) => (
                <tr key={run.id} className="align-top text-sm">
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-neutral-900 dark:text-neutral-100">
                    {formatDateTime(run.startedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={run.status} />
                  </td>
                  <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                    <div>{getTriggerTypeLabel(run.triggerType)}</div>
                    <div className="mt-1 text-xs">{run.dryRun ? "dry run" : "write"}</div>
                    {run.actorEmail ? <div className="mt-1 text-xs">{run.actorEmail}</div> : null}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-neutral-600 dark:text-neutral-400">
                    {run.source}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-neutral-600 dark:text-neutral-400">
                    {formatDuration(run.durationMs)}
                  </td>
                  <td className="px-4 py-3 text-xs text-neutral-600 dark:text-neutral-400">
                    {formatCounts(run.counts)}
                  </td>
                  <td className="max-w-sm px-4 py-3 text-neutral-700 dark:text-neutral-300">
                    <p className="line-clamp-3 leading-6">{run.message || "-"}</p>
                    {run.errorCode ? (
                      <p className="mt-1 text-xs font-semibold text-rose-700 dark:text-rose-300">
                        {run.errorCode}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <RunDetails run={run} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-5 py-8 text-center text-sm font-medium text-neutral-500 dark:text-neutral-400">
          아직 동기화 실행 이력이 없습니다.
        </p>
      )}
    </section>
  );
}

function RunDetails({ run }: { run: SyncRun }) {
  const detailCount = run.warnings.length + run.errors.length;

  if (detailCount === 0) {
    return <span className="text-sm text-neutral-400 dark:text-neutral-500">없음</span>;
  }

  return (
    <details className="min-w-44">
      <summary className="cursor-pointer text-sm font-semibold text-neutral-700 dark:text-neutral-300">
        경고 {run.warnings.length} · 오류 {run.errors.length}
      </summary>
      <div className="mt-2 space-y-2">
        {run.warnings.map((warning, index) => (
          <p key={`${index}-${warning}`} className="rounded-md bg-amber-50 px-2 py-1.5 text-xs leading-5 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
            {warning}
          </p>
        ))}
        {run.errors.map((error, index) => (
          <p key={`${index}-${error}`} className="rounded-md bg-rose-50 px-2 py-1.5 text-xs leading-5 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200">
            {error}
          </p>
        ))}
      </div>
    </details>
  );
}

function SchemaRequiredPanel({ dashboard }: { dashboard: Exclude<SyncRunDashboard, { ok: true }> }) {
  return (
    <section className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/70 dark:bg-amber-950/30">
      <div className="flex items-start gap-3">
        <Database size={20} aria-hidden="true" className="mt-0.5 text-amber-700 dark:text-amber-300" />
        <div>
          <h2 className="text-lg font-semibold text-amber-950 dark:text-amber-100">
            스키마 적용 필요
          </h2>
          <p className="mt-2 text-sm leading-6 text-amber-800 dark:text-amber-200">
            {dashboard.message}
          </p>
          <p className="mt-3 text-sm leading-6 text-amber-800 dark:text-amber-200">
            Supabase SQL Editor에서 `supabase/schema.sql`의 `admin_users`, `sync_runs`
            관련 구문을 적용한 뒤 운영자 이메일을 추가해 주세요.
          </p>
        </div>
      </div>
    </section>
  );
}

function StatusMetric({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  tone: "success" | "failed" | "unauthorized" | "neutral";
}) {
  const toneClassName = {
    success:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/60 dark:text-emerald-300",
    failed:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/60 dark:text-rose-300",
    unauthorized:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/60 dark:text-amber-300",
    neutral:
      "border-neutral-200 bg-neutral-100 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300",
  }[tone];

  return (
    <article className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm shadow-black/5 dark:border-neutral-800 dark:bg-neutral-950 dark:shadow-none">
      <div className="flex items-center gap-2">
        <span className={`inline-flex size-8 items-center justify-center rounded-md border ${toneClassName}`}>
          {icon}
        </span>
        <p className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">{label}</p>
      </div>
      <p className="mt-3 truncate text-lg font-semibold text-neutral-950 dark:text-white">{value}</p>
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
        {detail}
      </p>
    </article>
  );
}

function StatusPill({ status }: { status: SyncRunStatus }) {
  return (
    <span
      className={[
        "inline-flex h-7 items-center rounded-md border px-2.5 text-xs font-semibold",
        {
          success:
            "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/60 dark:text-emerald-300",
          failed:
            "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/60 dark:text-rose-300",
          unauthorized:
            "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/60 dark:text-amber-300",
        }[status],
      ].join(" ")}
    >
      {getStatusLabel(status)}
    </span>
  );
}

function ActionNotice({
  value,
  dryRun,
  source,
}: {
  value?: string;
  dryRun?: string;
  source: ManualSyncSource;
}) {
  if (!value) {
    return null;
  }

  const isSuccess = value === "success";
  const isForbidden =
    value === "forbidden" ||
    value === "login-required" ||
    value === "viewer-forbidden" ||
    value === "setup-required";
  const sourceLabel = getManualSyncSourceLabel(source);
  const actionLabel = dryRun === "1" ? "Dry run" : "동기화";
  const text = {
    success: `${sourceLabel} ${actionLabel} 실행이 완료되었습니다.`,
    failed: `${sourceLabel} ${actionLabel} 실행에 실패했습니다. 실행 이력을 확인해 주세요.`,
    forbidden: "이 Google 계정은 운영자 권한이 없습니다.",
    "login-required": "로그인 세션이 만료되었습니다. 다시 로그인한 뒤 실행해 주세요.",
    "viewer-forbidden": "viewer 권한은 이력 조회만 가능하고 동기화 실행은 admin 권한이 필요합니다.",
    "setup-required": "관리자 권한 확인 설정이 완료되지 않아 동기화를 실행할 수 없습니다.",
  }[value];

  if (!text) {
    return null;
  }

  return (
    <div
      className={[
        "mb-5 rounded-lg border px-4 py-3 text-sm font-semibold",
        isSuccess
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/60 dark:text-emerald-300"
          : isForbidden
            ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/60 dark:text-amber-300"
            : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/60 dark:text-rose-300",
      ].join(" ")}
    >
      {text}
    </div>
  );
}

function AuthNotice({ value }: { value: string }) {
  const text = {
    "missing-env": "Supabase 인증 환경변수를 확인해 주세요.",
    "login-error": "Google 로그인 URL을 만들지 못했습니다.",
    "missing-code": "OAuth callback code가 없습니다.",
    "callback-error": "Google 로그인 콜백 처리에 실패했습니다.",
    "signed-in": "로그인되었습니다.",
    "signed-out": "로그아웃되었습니다.",
  }[value];

  if (!text) {
    return null;
  }

  return (
    <p className="mt-3 rounded-md bg-neutral-50 px-3 py-2 text-sm font-medium text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300">
      {text}
    </p>
  );
}

function SetupHint() {
  return (
    <div className="mt-4 rounded-md bg-neutral-50 p-4 text-sm leading-6 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300">
      <p className="font-semibold text-neutral-900 dark:text-neutral-100">필요 설정</p>
      <p className="mt-1">
        Supabase Google provider, `NEXT_PUBLIC_SUPABASE_URL`,
        `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
        `admin_users` 테이블을 확인해 주세요.
      </p>
    </div>
  );
}

function getParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function getStatusLabel(status: SyncRunStatus) {
  return {
    success: "성공",
    failed: "실패",
    unauthorized: "인증 실패",
  }[status];
}

function getStatusTone(status: SyncRunStatus) {
  return status === "success" ? "success" : status === "failed" ? "failed" : "unauthorized";
}

function getTriggerTypeLabel(type: SyncRunTriggerType) {
  return type === "manual" ? "수동" : "cron";
}

function readManualSyncSource(value: FormDataEntryValue | string | null | undefined): ManualSyncSource {
  return value === "hotdeals" ? "hotdeals" : "ipos";
}

function getManualSyncDeniedCode(access: Exclude<AdminAccess, { state: "authorized" }>) {
  return ({
    anonymous: "login-required",
    "missing-env": "setup-required",
    "setup-required": "setup-required",
    forbidden: "forbidden",
  })[access.state];
}

function getManualSyncSourceLabel(source: ManualSyncSource) {
  return source === "hotdeals" ? "핫딜" : "공모주";
}

function formatCounts(counts: Record<string, unknown> | null) {
  if (!counts) {
    return "-";
  }

  const entries = Object.entries(counts).filter(([, value]) => value !== null && value !== undefined);

  if (entries.length === 0) {
    return "-";
  }

  return (
    <div className="grid gap-1">
      {entries.map(([key, value]) => (
        <span key={key} className="font-mono text-[11px]">
          {key}: {String(value)}
        </span>
      ))}
    </div>
  );
}

function formatDuration(value?: number | null) {
  if (value === null || value === undefined) {
    return "미확인";
  }

  if (value < 1000) {
    return `${value}ms`;
  }

  return `${(value / 1000).toFixed(1)}초`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}
