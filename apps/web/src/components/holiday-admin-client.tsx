"use client";

import { api } from "@/lib/api";
import type { HolidayRun } from "@/types/calendar";
import { AppSidebar, Badge, Button, Card, Select, StatusBadge } from "@/components/ui";
import { RefreshCw, Play, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

export function HolidayAdminClient() {
  const router = useRouter();
  const [year, setYear] = useState(2026);
  const [status, setStatus] = useState("ALL");
  const [runs, setRuns] = useState<HolidayRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      await api.me();
      setRuns(await api.holidayRuns(year, status));
    } catch (err) {
      setError(err instanceof Error ? err.message : "공휴일 배치 이력을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function runManual() {
    setLoading(true);
    try {
      await api.runHolidaySync(year);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "수동 실행에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, status]);

  const latestSuccess = runs.find((run) => run.status === "SUCCESS");
  const failedCount = runs.filter((run) => run.status === "FAILED" || run.status === "PARTIAL_SUCCESS").length;
  const totalHolidays = runs[0]?.requestedCount || 0;

  return (
    <main className="flex min-h-screen bg-[#f6f8fb]">
      <AppSidebar active="holiday" />
      <section className="flex-1 overflow-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-extrabold">공휴일 배치 이력</h1>
          <p className="mt-2 text-slate-500">대한민국 공휴일 수집 배치의 실행 상태와 결과를 확인합니다.</p>
        </div>
        <Card className="mb-5 p-5">
          <div className="grid gap-3 lg:grid-cols-[160px_160px_1fr_auto_auto]">
            <Select value="KR" disabled><option>KR</option></Select>
            <Select value={year} onChange={(e) => setYear(Number(e.target.value))}><option value={2025}>2025</option><option value={2026}>2026</option><option value={2027}>2027</option></Select>
            <Select value={status} onChange={(e) => setStatus(e.target.value)}><option value="ALL">전체</option><option value="SUCCESS">성공</option><option value="PARTIAL_SUCCESS">일부 성공</option><option value="FAILED">실패</option><option value="RUNNING">실행 중</option></Select>
            <Button disabled={loading} onClick={runManual}><Play size={16} /> 수동 실행</Button>
            <Button variant="secondary" disabled={loading} onClick={load}><RefreshCw size={16} /> 새로고침</Button>
          </div>
        </Card>
        {error ? <div className="mb-5 rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div> : null}
        <div className="mb-5 grid gap-4 lg:grid-cols-4">
          <Metric title="최근 성공 시각" value={latestSuccess ? new Date(latestSuccess.finishedAt || latestSuccess.startedAt).toLocaleString("ko-KR") : "-"} />
          <Metric title="수집된 공휴일 수" value={`${totalHolidays}건`} />
          <Metric title="최근 실패 건수" value={`${failedCount}건`} tone="rose" />
          <Metric title="다음 예정 실행" value="2026.05.25 03:00" tone="purple" />
        </div>
        <div className="mb-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm font-bold text-blue-700">공휴일 캘린더는 읽기 전용 시스템 캘린더이며, 배치 작업으로만 갱신됩니다.</div>
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  {["실행 ID", "대상 연도", "상태", "트리거", "시작 시각", "종료 시각", "수집", "생성", "갱신", "스킵", "실패", "관리"].map((head) => <th key={head} className="px-4 py-3 font-bold">{head}</th>)}
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-mono text-xs">{run.id.slice(0, 12)}</td>
                    <td className="px-4 py-3">{run.targetYear} (KR)</td>
                    <td className="px-4 py-3"><StatusBadge status={run.status} /></td>
                    <td className="px-4 py-3">{run.triggerType}</td>
                    <td className="px-4 py-3">{new Date(run.startedAt).toLocaleString("ko-KR")}</td>
                    <td className="px-4 py-3">{run.finishedAt ? new Date(run.finishedAt).toLocaleString("ko-KR") : "-"}</td>
                    <td className="px-4 py-3">{run.requestedCount}</td>
                    <td className="px-4 py-3">{run.createdCount}</td>
                    <td className="px-4 py-3">{run.updatedCount}</td>
                    <td className="px-4 py-3">{run.skippedCount}</td>
                    <td className="px-4 py-3">{run.failedCount}</td>
                    <td className="px-4 py-3"><Button variant="secondary" onClick={() => router.push(`/admin/holiday-sync-runs/${run.id}`)}>상세 보기</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </main>
  );
}

export function HolidayRunDetailClient({ runId }: { runId: string }) {
  const [run, setRun] = useState<HolidayRun | null>(null);
  const [error, setError] = useState("");
  async function load() {
    try {
      setRun(await api.holidayRun(runId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "상세 정보를 불러오지 못했습니다.");
    }
  }
  async function rerun() {
    if (!run) return;
    await api.runHolidaySync(run.targetYear);
    await load();
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);
  return (
    <main className="flex min-h-screen bg-[#f6f8fb]">
      <AppSidebar active="holiday" />
      <section className="flex-1 overflow-auto p-6">
        <h1 className="mb-2 text-3xl font-extrabold">공휴일 배치 상세</h1>
        {error ? <div className="mb-5 rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div> : null}
        {run ? (
          <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
            <div className="space-y-5">
              <Card className="p-5">
                <div className="grid gap-4 lg:grid-cols-3">
                  <Info label="실행 ID" value={run.id} />
                  <Info label="대상 국가" value={run.targetCountryCode} />
                  <Info label="대상 연도" value={String(run.targetYear)} />
                  <Info label="상태" value={<StatusBadge status={run.status} />} />
                  <Info label="트리거" value={run.triggerType} />
                  <Info label="시작 시각" value={new Date(run.startedAt).toLocaleString("ko-KR")} />
                </div>
              </Card>
              <div className="grid gap-4 lg:grid-cols-5">
                <Metric title="요청 건수" value={String(run.requestedCount)} />
                <Metric title="생성 건수" value={String(run.createdCount)} />
                <Metric title="갱신 건수" value={String(run.updatedCount)} />
                <Metric title="스킵 건수" value={String(run.skippedCount)} />
                <Metric title="실패 건수" value={String(run.failedCount)} tone="rose" />
              </div>
              <Card className="overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500"><tr>{["단계", "에러 코드", "에러 메시지", "외부 상태", "재시도 가능", "생성 시각"].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead>
                  <tbody>
                    {(run.failures || []).map((failure) => (
                      <tr key={failure.id} className="border-t border-slate-100">
                        <td className="px-4 py-3">{failure.stage}</td>
                        <td className="px-4 py-3 font-mono text-xs">{failure.errorCode}</td>
                        <td className="px-4 py-3">{failure.errorMessage}</td>
                        <td className="px-4 py-3">{failure.externalStatus || "-"}</td>
                        <td className="px-4 py-3">{failure.isRetryable ? <Badge color="amber">가능</Badge> : <Badge>불가</Badge>}</td>
                        <td className="px-4 py-3">{new Date(failure.createdAt).toLocaleString("ko-KR")}</td>
                      </tr>
                    ))}
                    {(run.failures || []).length === 0 ? <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={6}>실패 로그가 없습니다.</td></tr> : null}
                  </tbody>
                </table>
              </Card>
            </div>
            <Card className="h-fit p-5">
              <ShieldAlert className="mb-3 text-rose-500" />
              <h3 className="text-lg font-extrabold">재시도 정책</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">네트워크 오류와 저장 충돌은 재시도 가능으로 기록합니다. API 키, 인증 토큰, Authorization 헤더는 로그에 저장되지 않습니다.</p>
              <Button className="mt-5 w-full" onClick={rerun}>수동 재실행</Button>
            </Card>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function Metric({ title, value, tone = "blue" }: { title: string; value: string; tone?: "blue" | "rose" | "purple" }) {
  const toneClass = tone === "rose" ? "text-rose-600 bg-rose-50" : tone === "purple" ? "text-purple-600 bg-purple-50" : "text-[#0B3B91] bg-blue-50";
  return <Card className="p-5"><p className="text-sm font-bold text-slate-500">{title}</p><p className={`mt-3 rounded-2xl px-3 py-2 text-xl font-extrabold ${toneClass}`}>{value}</p></Card>;
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return <div><p className="text-sm font-bold text-slate-500">{label}</p><div className="mt-2 font-extrabold">{value}</div></div>;
}
