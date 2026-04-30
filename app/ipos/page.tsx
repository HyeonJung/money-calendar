import type { Metadata } from "next";
import { IpoExplorer } from "@/components/ipo-explorer";
import { getIpos } from "@/lib/ipos";

export const metadata: Metadata = {
  title: "공모주 | 머니캘린더",
  description: "공모주 청약, 환불, 상장 일정을 검색하고 상태별로 비교하세요.",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function IposPage() {
  const ipos = await getIpos();
  const todayIso = getTodayIsoInSeoul();

  return (
    <main>
      <section className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            공모주
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal text-neutral-950 dark:text-white">
            공모주 탐색
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600 dark:text-neutral-400">
            청약중, 청약 임박, 상장 임박, 상장 완료 종목을 한곳에서 검색하고
            주관사와 일정 기준으로 비교할 수 있습니다.
          </p>
        </div>
      </section>

      <IpoExplorer ipos={ipos} todayIso={todayIso} />
    </main>
  );
}

function getTodayIsoInSeoul() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [{ value: year }, , { value: month }, , { value: day }] =
    formatter.formatToParts(new Date());

  return `${year}-${month}-${day}`;
}
