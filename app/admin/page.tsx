import type { InputHTMLAttributes, ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  Activity,
  AlertCircle,
  BadgePercent,
  Clock3,
  Database,
  ExternalLink,
  ImageOff,
  Layers3,
  LinkIcon,
  LogIn,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  WandSparkles,
} from "lucide-react";
import { getAdminAccess, type AdminAccess } from "@/lib/admin-auth";
import { createHotDealInputFromProductUrl } from "@/lib/hotdeal-link-parser";
import {
  createManualHotDeal,
  deleteHotDeal,
  expireOldHotDeals,
  getAdminHotDeals,
  getAdminHotDealMetrics,
  HOT_DEAL_EXPIRATION_HOURS,
  updateManualHotDeal,
  type AdminHotDeal,
  type AdminHotDealMetricsResult,
  type HotDealMutationInput,
  type HotDealStatus,
} from "@/lib/hot-deals";
import {
  getSyncRunDashboard,
  type SyncRun,
  type SyncRunDashboard,
} from "@/lib/sync-runs";

type AdminPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: "관리자 | 머니캘린더",
  description: "머니캘린더 운영자용 핫딜 관리 페이지입니다.",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = searchParams ? await searchParams : {};
  const access = await getAdminAccess();

  if (access.state === "anonymous" || access.state === "missing-env") {
    return (
      <AdminPageShell access={access}>
        <LoginRequired access={access} />
      </AdminPageShell>
    );
  }

  if (access.state === "setup-required" || access.state === "forbidden") {
    return (
      <AdminPageShell access={access}>
        <AccessBlocked access={access} />
      </AdminPageShell>
    );
  }

  const [hotDeals, hotDealMetrics, syncDashboard] = await Promise.all([
    getAdminHotDeals(100),
    getAdminHotDealMetrics(),
    getSyncRunDashboard(30),
  ]);

  return (
    <AdminPageShell access={access}>
      <ActionNotice value={getParam(params, "hotdeal")} />
      <AdminOverview
        hotDeals={hotDeals}
        hotDealMetrics={hotDealMetrics}
        syncDashboard={syncDashboard}
        canEdit={access.canRunSync}
      />
      <CreateHotDealPanel canEdit={access.canRunSync} />
      {hotDeals.ok ? (
        <HotDealsManagementTable deals={hotDeals.deals} canEdit={access.canRunSync} />
      ) : (
        <SchemaRequiredPanel message={hotDeals.message} />
      )}
    </AdminPageShell>
  );
}

async function createHotDealAction(formData: FormData) {
  "use server";

  const access = await getAdminAccess();
  if (access.state !== "authorized" || !access.canRunSync) {
    redirect("/admin?hotdeal=forbidden");
  }

  const result = await createManualHotDeal(readHotDealForm(formData), access.user.email);

  revalidatePath("/admin");
  revalidatePath("/hotdeals");
  redirect(`/admin?hotdeal=${result.ok ? "created" : "failed"}`);
}

async function createHotDealFromUrlAction(formData: FormData) {
  "use server";

  const access = await getAdminAccess();
  if (access.state !== "authorized" || !access.canRunSync) {
    redirect("/admin?hotdeal=forbidden");
  }

  const parsed = await createHotDealInputFromProductUrl(String(formData.get("productUrl") ?? ""));

  if (!parsed.ok) {
    redirect("/admin?hotdeal=auto-failed");
  }

  const result = await createManualHotDeal(parsed.input, access.user.email);
  const status = result.ok
    ? parsed.usedFallback
      ? "auto-created-minimal"
      : "auto-created"
    : result.message.includes("이미 같은")
      ? "duplicated"
      : "failed";

  revalidatePath("/admin");
  revalidatePath("/hotdeals");
  redirect(`/admin?hotdeal=${status}`);
}

async function updateHotDealAction(formData: FormData) {
  "use server";

  const access = await getAdminAccess();
  if (access.state !== "authorized" || !access.canRunSync) {
    redirect("/admin?hotdeal=forbidden");
  }

  const id = String(formData.get("id") ?? "");
  if (!id) {
    redirect("/admin?hotdeal=failed");
  }

  const result = await updateManualHotDeal(id, readHotDealForm(formData), access.user.email);

  revalidatePath("/admin");
  revalidatePath("/hotdeals");
  redirect(`/admin?hotdeal=${result.ok ? "updated" : "failed"}`);
}

async function deleteHotDealAction(formData: FormData) {
  "use server";

  const access = await getAdminAccess();
  if (access.state !== "authorized" || !access.canRunSync) {
    redirect("/admin?hotdeal=forbidden");
  }

  const id = String(formData.get("id") ?? "");
  if (!id) {
    redirect("/admin?hotdeal=failed");
  }

  const result = await deleteHotDeal(id);

  revalidatePath("/admin");
  revalidatePath("/hotdeals");
  redirect(`/admin?hotdeal=${result.ok ? "deleted" : "failed"}`);
}

async function expireHotDealsAction() {
  "use server";

  const access = await getAdminAccess();
  if (access.state !== "authorized" || !access.canRunSync) {
    redirect("/admin?hotdeal=forbidden");
  }

  const result = await expireOldHotDeals();

  revalidatePath("/admin");
  revalidatePath("/hotdeals");
  redirect(`/admin?hotdeal=${result.ok ? "expired" : "expire-failed"}`);
}

function AdminPageShell({
  access,
  children,
}: {
  access: AdminAccess;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-3 border-b border-neutral-200 pb-5 dark:border-neutral-800 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            운영자
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal text-neutral-950 dark:text-white">
            관리자 페이지
          </h1>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            핫딜을 직접 등록하고 운영 상태를 관리합니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/sync"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-50 hover:text-neutral-950 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:border-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-white"
          >
            <RefreshCw size={15} aria-hidden="true" />
            동기화 상태
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
        </div>
      </div>
      {children}
    </main>
  );
}

function LoginRequired({
  access,
}: {
  access: Extract<AdminAccess, { state: "anonymous" | "missing-env" }>;
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
          {access.state === "anonymous" ? (
            <Link
              href={`/auth/login?next=${encodeURIComponent("/admin")}`}
              className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              <LogIn size={16} aria-hidden="true" />
              Google로 로그인
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function AccessBlocked({
  access,
}: {
  access: Extract<AdminAccess, { state: "setup-required" | "forbidden" }>;
}) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm shadow-black/5 dark:border-neutral-800 dark:bg-neutral-950 dark:shadow-none">
      <div className="flex items-start gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
          <AlertCircle size={20} aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-neutral-950 dark:text-white">
            접근할 수 없습니다
          </h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
            {access.message}
          </p>
        </div>
      </div>
    </section>
  );
}

function AdminOverview({
  hotDeals,
  hotDealMetrics,
  syncDashboard,
  canEdit,
}: {
  hotDeals: Awaited<ReturnType<typeof getAdminHotDeals>>;
  hotDealMetrics: AdminHotDealMetricsResult;
  syncDashboard: SyncRunDashboard;
  canEdit: boolean;
}) {
  const metrics = hotDealMetrics.ok ? hotDealMetrics.metrics : null;
  const fallbackActiveCount = hotDeals.ok
    ? hotDeals.deals.filter((deal) => deal.status === "active").length
    : 0;
  const fallbackHiddenCount = hotDeals.ok
    ? hotDeals.deals.filter((deal) => deal.status !== "active").length
    : 0;
  const syncSummary = buildHotDealSyncSummary(syncDashboard);
  const activeCount = metrics?.activeCount ?? fallbackActiveCount;
  const hiddenCount = metrics ? metrics.expiredCount + metrics.hiddenCount : fallbackHiddenCount;

  return (
    <>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<BadgePercent size={18} aria-hidden="true" />}
          label="오늘 수집"
          value={metrics ? `${formatNumber(metrics.collectedTodayCount)}건` : "조회 실패"}
          detail={
            metrics
              ? `최근 24시간 ${formatNumber(metrics.collectedLast24HoursCount)}건 · 수동 ${formatNumber(metrics.manualCreatedTodayCount)}건`
              : hotDealMetrics.message
          }
          tone="success"
        />
        <MetricCard
          icon={<ExternalLink size={18} aria-hidden="true" />}
          label="노출 중"
          value={`${formatNumber(activeCount)}건`}
          detail={`비노출 ${formatNumber(hiddenCount)}건 · 총 ${formatNumber(
            metrics?.totalCount ?? (hotDeals.ok ? hotDeals.deals.length : 0),
          )}건`}
          tone="neutral"
        />
        <MetricCard
          icon={<RefreshCw size={18} aria-hidden="true" />}
          label="최근 핫딜 동기화"
          value={syncSummary.latest ? getSyncStatusLabel(syncSummary.latest.status) : "이력 없음"}
          detail={
            syncSummary.latest
              ? `${formatDateTime(syncSummary.latest.startedAt)} · 성공률 ${syncSummary.successRateLabel}`
              : syncDashboard.ok
                ? "핫딜 동기화 이력이 없습니다."
                : syncDashboard.message
          }
          tone={syncSummary.latest ? getMetricToneByStatus(syncSummary.latest.status) : "neutral"}
        />
        <MetricCard
          icon={<Activity size={18} aria-hidden="true" />}
          label="중복 스킵"
          value={`${formatNumber(syncSummary.recentDuplicateSkipped)}건`}
          detail={
            syncSummary.latest
              ? `최근 10회 기준 · 마지막 저장 ${formatNumber(syncSummary.latestUpserted)}건`
              : "최근 핫딜 동기화 기준"
          }
          tone="warning"
        />
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_1fr_1fr]">
        <DashboardPanel
          icon={<Clock3 size={18} aria-hidden="true" />}
          title="동기화 상태"
          description={syncSummary.latest?.message ?? "최근 핫딜 동기화 메시지가 없습니다."}
        >
          <DashboardFact label="마지막 실행" value={syncSummary.latest ? formatDateTime(syncSummary.latest.startedAt) : "-"} />
          <DashboardFact label="마지막 실패" value={syncSummary.latestFailure ? formatDateTime(syncSummary.latestFailure.startedAt) : "없음"} />
          <DashboardFact label="마지막 수집/저장" value={`${formatNumber(syncSummary.latestFetched)} / ${formatNumber(syncSummary.latestUpserted)}건`} />
          <DashboardFact label="경고/오류" value={`${formatNumber(syncSummary.warningCount)} / ${formatNumber(syncSummary.errorCount)}건`} />
        </DashboardPanel>

        <DashboardPanel
          icon={<Layers3 size={18} aria-hidden="true" />}
          title="수집 소스"
          description="최근 저장된 핫딜 기준 상위 소스입니다."
        >
          {metrics?.sourceBreakdown.length ? (
            <BreakdownList
              items={metrics.sourceBreakdown}
              total={metrics.sourceBreakdown.reduce((total, item) => total + item.count, 0)}
            />
          ) : (
            <EmptyDashboardText text={metrics ? "소스 데이터가 없습니다." : hotDealMetrics.message} />
          )}
        </DashboardPanel>

        <DashboardPanel
          icon={<ImageOff size={18} aria-hidden="true" />}
          title="품질 체크"
          description="노출 중인 핫딜 중 보완이 필요한 항목입니다."
        >
          <DashboardFact
            label="만료 대상"
            value={metrics ? `${formatNumber(metrics.expireCandidateCount)}건` : "-"}
          />
          <DashboardFact
            label="이미지 없음"
            value={metrics ? `${formatNumber(metrics.activeWithoutImageCount)}건` : "-"}
          />
          <DashboardFact
            label="가격 없음"
            value={metrics ? `${formatNumber(metrics.activeWithoutPriceCount)}건` : "-"}
          />
          <DashboardFact
            label="마지막 수집"
            value={metrics?.latestCollectedAt ? formatDateTime(metrics.latestCollectedAt) : "-"}
          />
          <DashboardFact
            label="카테고리 상위"
            value={metrics?.categoryBreakdown[0]?.label ?? "-"}
          />
          <form action={expireHotDealsAction}>
            <button
              type="submit"
              disabled={!canEdit}
              className="mt-1 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <RefreshCw size={15} aria-hidden="true" />
              {HOT_DEAL_EXPIRATION_HOURS}시간 지난 핫딜 만료
            </button>
          </form>
        </DashboardPanel>
      </section>
    </>
  );
}

function CreateHotDealPanel({ canEdit }: { canEdit: boolean }) {
  return (
    <section className="mt-5 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm shadow-black/5 dark:border-neutral-800 dark:bg-neutral-950 dark:shadow-none">
      <div className="border-b border-neutral-100 px-4 py-4 dark:border-neutral-800 sm:px-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-neutral-950 dark:text-white">핫딜 등록</h2>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              동일 상품 주소가 이미 있으면 새로 등록되지 않습니다.
            </p>
          </div>
          <p className="text-xs font-semibold text-neutral-400 dark:text-neutral-500">
            필수: 제목, 상품 주소
          </p>
        </div>
      </div>
      <div className="p-4 sm:p-5">
        <QuickHotDealForm canEdit={canEdit} />
        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-neutral-100 dark:bg-neutral-800" />
          <span className="text-xs font-semibold text-neutral-400 dark:text-neutral-500">
            또는 직접 입력
          </span>
          <div className="h-px flex-1 bg-neutral-100 dark:bg-neutral-800" />
        </div>
        <HotDealForm action={createHotDealAction} canEdit={canEdit} submitLabel="등록" />
      </div>
    </section>
  );
}

function QuickHotDealForm({ canEdit }: { canEdit: boolean }) {
  return (
    <form
      action={createHotDealFromUrlAction}
      className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/20"
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
        <label className="grid min-w-0 flex-1 gap-1.5">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
            <LinkIcon size={14} aria-hidden="true" />
            상품 링크 빠른 등록
          </span>
          <input
            name="productUrl"
            type="url"
            required
            placeholder="쿠팡/쇼핑몰 상품 링크를 붙여넣으세요"
            className="h-12 w-full min-w-0 rounded-lg border border-emerald-200 bg-white px-3 text-sm font-semibold text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-emerald-900 dark:bg-neutral-950 dark:text-neutral-100"
          />
        </label>
        <button
          type="submit"
          disabled={!canEdit}
          className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <WandSparkles size={16} aria-hidden="true" />
          링크로 자동 등록
        </button>
      </div>
      <p className="mt-3 text-xs leading-5 text-emerald-800/80 dark:text-emerald-200/80">
        접근 가능한 상품 페이지는 제목, 이미지, 가격을 읽어오고 쿠팡처럼 차단되는 경우는 URL 기준으로
        최소 정보가 등록됩니다.
      </p>
    </form>
  );
}

function HotDealsManagementTable({
  deals,
  canEdit,
}: {
  deals: AdminHotDeal[];
  canEdit: boolean;
}) {
  return (
    <section className="mt-5 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm shadow-black/5 dark:border-neutral-800 dark:bg-neutral-950 dark:shadow-none">
      <div className="border-b border-neutral-200 px-4 py-4 dark:border-neutral-800 sm:px-5">
        <h2 className="text-lg font-semibold text-neutral-950 dark:text-white">핫딜 관리</h2>
      </div>
      <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
        {deals.length > 0 ? (
          deals.map((deal) => (
            <article key={deal.id} className="p-4 sm:p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={deal.status} />
                    {deal.category ? (
                      <span className="rounded-md bg-neutral-100 px-2 py-1 text-xs font-semibold text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300">
                        {deal.category}
                      </span>
                    ) : null}
                    <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                      {formatDateTime(deal.createdAt)}
                    </span>
                  </div>
                  <h3 className="mt-2 text-base font-semibold text-neutral-950 dark:text-white">
                    {deal.title}
                  </h3>
                  <p className="mt-1 break-all text-sm text-neutral-500 dark:text-neutral-400">
                    {deal.dealUrl}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Link
                    href={deal.dealUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
                  >
                    <ExternalLink size={15} aria-hidden="true" />
                    보기
                  </Link>
                  <form action={deleteHotDealAction}>
                    <input type="hidden" name="id" value={deal.id} />
                    <button
                      type="submit"
                      disabled={!canEdit}
                      className="inline-flex h-9 items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-3 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-45 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-950"
                    >
                      <Trash2 size={15} aria-hidden="true" />
                      삭제
                    </button>
                  </form>
                </div>
              </div>
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                  수정 폼 열기
                </summary>
                <div className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
                  <HotDealForm
                    action={updateHotDealAction}
                    canEdit={canEdit}
                    submitLabel="수정"
                    deal={deal}
                  />
                </div>
              </details>
            </article>
          ))
        ) : (
          <p className="px-5 py-10 text-center text-sm font-medium text-neutral-500 dark:text-neutral-400">
            등록된 핫딜이 없습니다.
          </p>
        )}
      </div>
    </section>
  );
}

function HotDealForm({
  action,
  canEdit,
  submitLabel,
  deal,
}: {
  action: (formData: FormData) => Promise<void>;
  canEdit: boolean;
  submitLabel: string;
  deal?: AdminHotDeal;
}) {
  return (
    <form action={action} className="grid w-full min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-12">
      {deal ? <input type="hidden" name="id" value={deal.id} /> : null}
      <TextField
        name="title"
        label="제목"
        defaultValue={deal?.title}
        required
        className="md:col-span-2 xl:col-span-5"
      />
      <TextField
        name="dealUrl"
        label="상품 주소"
        defaultValue={deal?.dealUrl}
        required
        className="md:col-span-2 xl:col-span-7"
      />
      <TextField
        name="imageUrl"
        label="이미지 주소"
        defaultValue={deal?.imageUrl ?? ""}
        className="md:col-span-2 xl:col-span-3"
      />
      <TextField
        name="priceText"
        label="가격"
        defaultValue={deal?.priceText ?? ""}
        placeholder="예: 9,900원 / 무료배송"
        className="xl:col-span-2"
      />
      <TextField
        name="category"
        label="카테고리"
        defaultValue={deal?.category ?? ""}
        placeholder="식품"
        className="xl:col-span-2"
      />
      <label className="grid min-w-0 gap-1.5 xl:col-span-2">
        <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">상태</span>
        <select
          name="status"
          defaultValue={deal?.status ?? "active"}
          className="h-11 w-full min-w-0 rounded-lg border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
        >
          <option value="active">노출</option>
          <option value="expired">만료</option>
          <option value="hidden">숨김</option>
        </select>
      </label>
      <TextField
        name="publishedAt"
        label="게시 시각"
        type="datetime-local"
        defaultValue={toDateTimeLocalValue(deal?.publishedAt)}
        className="md:col-span-2 xl:col-span-3"
      />
      <div className="flex items-end justify-end md:col-span-2 xl:col-span-12">
        <button
          type="submit"
          disabled={!canEdit}
          className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
        >
          {submitLabel === "등록" ? <Plus size={16} aria-hidden="true" /> : <Pencil size={16} aria-hidden="true" />}
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

function TextField({
  name,
  label,
  className,
  ...props
}: {
  name: string;
  label: string;
  className?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={["grid min-w-0 gap-1.5", className].filter(Boolean).join(" ")}>
      <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">{label}</span>
      <input
        name={name}
        className="h-11 w-full min-w-0 rounded-lg border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
        {...props}
      />
    </label>
  );
}

type MetricTone = "success" | "warning" | "danger" | "neutral";

function MetricCard({
  icon,
  label,
  value,
  detail,
  tone = "neutral",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  tone?: MetricTone;
}) {
  const toneClassName = {
    success:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
    warning:
      "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
    danger: "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
    neutral:
      "bg-neutral-100 text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300",
  }[tone];

  return (
    <article className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm shadow-black/5 dark:border-neutral-800 dark:bg-neutral-950 dark:shadow-none">
      <div className="flex items-center gap-2">
        <span className={`inline-flex size-8 items-center justify-center rounded-md ${toneClassName}`}>
          {icon}
        </span>
        <p className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">{label}</p>
      </div>
      <p className="mt-3 text-lg font-semibold text-neutral-950 dark:text-white">{value}</p>
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
        {detail}
      </p>
    </article>
  );
}

function DashboardPanel({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <article className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm shadow-black/5 dark:border-neutral-800 dark:bg-neutral-950 dark:shadow-none">
      <div className="flex items-start gap-3">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-neutral-950 dark:text-white">{title}</h2>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-neutral-500 dark:text-neutral-400">
            {description}
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-2">{children}</div>
    </article>
  );
}

function DashboardFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-neutral-50 px-3 py-2 dark:bg-neutral-900/70">
      <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
        {label}
      </span>
      <span className="max-w-[60%] truncate text-right text-sm font-semibold text-neutral-950 dark:text-white">
        {value}
      </span>
    </div>
  );
}

function BreakdownList({
  items,
  total,
}: {
  items: Array<{ label: string; count: number }>;
  total: number;
}) {
  return (
    <div className="grid gap-2">
      {items.map((item) => {
        const ratio = total > 0 ? Math.round((item.count / total) * 100) : 0;

        return (
          <div key={item.label} className="grid gap-1.5">
            <div className="flex items-center justify-between gap-3">
              <span className="truncate text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                {item.label}
              </span>
              <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                {formatNumber(item.count)}건
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-900">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${Math.max(4, ratio)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EmptyDashboardText({ text }: { text: string }) {
  return (
    <p className="rounded-md bg-neutral-50 px-3 py-3 text-sm leading-6 text-neutral-500 dark:bg-neutral-900/70 dark:text-neutral-400">
      {text}
    </p>
  );
}

function SchemaRequiredPanel({ message }: { message: string }) {
  return (
    <section className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/70 dark:bg-amber-950/30">
      <div className="flex items-start gap-3">
        <Database size={20} aria-hidden="true" className="mt-0.5 text-amber-700 dark:text-amber-300" />
        <div>
          <h2 className="text-lg font-semibold text-amber-950 dark:text-amber-100">
            스키마 적용 필요
          </h2>
          <p className="mt-2 text-sm leading-6 text-amber-800 dark:text-amber-200">
            {message}
          </p>
        </div>
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: HotDealStatus }) {
  const config = {
    active: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
    expired: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
    hidden: "bg-neutral-100 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300",
  }[status];
  const label = {
    active: "노출",
    expired: "만료",
    hidden: "숨김",
  }[status];

  return <span className={`rounded-md px-2 py-1 text-xs font-semibold ${config}`}>{label}</span>;
}

function ActionNotice({ value }: { value?: string }) {
  if (!value) {
    return null;
  }

  const messages: Record<string, string> = {
    "auto-created": "상품 링크를 읽어 핫딜을 등록했습니다.",
    "auto-created-minimal":
      "상품 링크 접근이 제한되어 최소 정보로 등록했습니다. 필요하면 제목과 가격을 수정해 주세요.",
    "auto-failed": "상품 링크를 읽지 못했습니다. 직접 입력으로 등록해 주세요.",
    created: "핫딜을 등록했습니다.",
    updated: "핫딜을 수정했습니다.",
    deleted: "핫딜을 삭제했습니다.",
    expired: "24시간 지난 핫딜을 만료 처리했습니다.",
    "expire-failed": "핫딜 자동 만료 처리에 실패했습니다. DB 상태를 확인해 주세요.",
    duplicated: "이미 같은 상품 주소로 등록된 핫딜이 있습니다.",
    failed: "핫딜 처리에 실패했습니다. 입력값이나 DB 상태를 확인해 주세요.",
    forbidden: "핫딜을 변경할 권한이 없습니다.",
  };
  const message = messages[value];

  if (!message) {
    return null;
  }

  const isSuccess = [
    "auto-created",
    "auto-created-minimal",
    "created",
    "updated",
    "deleted",
    "expired",
  ].includes(value);

  return (
    <div
      className={[
        "mb-5 rounded-lg border px-4 py-3 text-sm font-semibold",
        isSuccess
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/60 dark:text-emerald-300"
          : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/60 dark:text-rose-300",
      ].join(" ")}
    >
      {message}
    </div>
  );
}

function readHotDealForm(formData: FormData): HotDealMutationInput {
  return {
    title: String(formData.get("title") ?? ""),
    dealUrl: String(formData.get("dealUrl") ?? ""),
    imageUrl: String(formData.get("imageUrl") ?? ""),
    priceText: String(formData.get("priceText") ?? ""),
    category: String(formData.get("category") ?? ""),
    status: readStatus(formData.get("status")),
    publishedAt: String(formData.get("publishedAt") ?? ""),
  };
}

function readStatus(value: FormDataEntryValue | null): HotDealStatus {
  return value === "expired" || value === "hidden" ? value : "active";
}

function buildHotDealSyncSummary(syncDashboard: SyncRunDashboard) {
  const hotDealRuns = syncDashboard.ok
    ? syncDashboard.runs.filter((run) => isHotDealSyncRun(run))
    : [];
  const recentRuns = hotDealRuns.slice(0, 10);
  const successCount = recentRuns.filter((run) => run.status === "success").length;
  const latest = hotDealRuns[0] ?? null;

  return {
    latest,
    latestFailure: hotDealRuns.find((run) => run.status === "failed") ?? null,
    successRateLabel:
      recentRuns.length > 0 ? `${Math.round((successCount / recentRuns.length) * 100)}%` : "-",
    recentDuplicateSkipped: recentRuns.reduce(
      (total, run) => total + getRunCount(run, "duplicateSkipped"),
      0,
    ),
    latestFetched: latest ? getRunCount(latest, "itemsFetched") : 0,
    latestUpserted: latest ? getRunCount(latest, "upserted") : 0,
    warningCount: recentRuns.reduce((total, run) => total + run.warnings.length, 0),
    errorCount: recentRuns.reduce((total, run) => total + run.errors.length, 0),
  };
}

function isHotDealSyncRun(run: SyncRun) {
  return run.source.includes("핫딜") || Boolean(run.counts && "duplicateSkipped" in run.counts);
}

function getRunCount(run: SyncRun, key: string) {
  const value = run.counts?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function getSyncStatusLabel(status: SyncRun["status"]) {
  return {
    success: "성공",
    failed: "실패",
    unauthorized: "인증 실패",
  }[status];
}

function getMetricToneByStatus(status: SyncRun["status"]): MetricTone {
  return status === "success" ? "success" : status === "failed" ? "danger" : "warning";
}

function formatNumber(value: number) {
  return value.toLocaleString("ko-KR");
}

function getParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function toDateTimeLocalValue(value?: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return formatter.format(date).replace(" ", "T");
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
