import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-2xl flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-semibold text-emerald-700">404</p>
      <h1 className="mt-3 text-2xl font-semibold text-neutral-950">
        공모주 정보를 찾을 수 없습니다
      </h1>
      <p className="mt-3 text-sm leading-6 text-neutral-600">
        일정이 변경되었거나 아직 등록되지 않은 공모주일 수 있습니다.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        홈으로
      </Link>
    </main>
  );
}
