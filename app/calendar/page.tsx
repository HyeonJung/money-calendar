import { CalendarView } from "@/components/calendar-view";
import { getIpos } from "@/lib/ipos";

export const metadata = {
  title: "공모주 일정 | 머니캘린더",
  description: "한국 공모주의 청약, 환불, 상장 일정을 월간 캘린더로 확인하세요.",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CalendarPage() {
  const ipos = await getIpos();

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">월간 일정</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal text-neutral-950 dark:text-white">
            공모주 일정
          </h1>
        </div>
        <p className="max-w-xl text-sm leading-6 text-neutral-600 dark:text-neutral-400">
          청약 시작과 종료, 환불일, 상장일을 같은 달력에서 확인할 수 있습니다.
          일정 항목을 누르면 상세 정보로 이동합니다.
        </p>
      </div>
      <CalendarView ipos={ipos} />
    </main>
  );
}
