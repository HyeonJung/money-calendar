"use client";

import { type ReactNode, useId, useState } from "react";
import { createPortal } from "react-dom";
import { ShieldCheck } from "lucide-react";

type ExternalDealLinkProps = {
  href: string;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
};

export function ExternalDealLink({
  href,
  children,
  className,
  ariaLabel,
}: ExternalDealLinkProps) {
  const [isOpen, setIsOpen] = useState(false);
  const titleId = useId();
  const descriptionId = useId();
  const hostname = formatHostname(href);
  const siteBadge = getSiteBadge(hostname);

  function handleConfirm() {
    window.open(href, "_blank", "noopener,noreferrer");
    setIsOpen(false);
  }

  return (
    <>
      <button
        type="button"
        className={className}
        aria-label={ariaLabel}
        onClick={() => setIsOpen(true)}
      >
        {children}
      </button>

      {isOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/65 px-4 py-6 backdrop-blur-sm"
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              aria-describedby={descriptionId}
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  setIsOpen(false);
                }
              }}
            >
              <div className="w-full max-w-[680px] overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-2xl shadow-black/25 dark:border-neutral-800 dark:bg-neutral-950">
                <div className="h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
                <div className="px-6 py-7 sm:px-11 sm:py-10">
                  <div className="flex items-center gap-5">
                    <span className="inline-flex size-20 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
                      <ShieldCheck size={42} strokeWidth={1.9} aria-hidden="true" />
                    </span>
                    <h2
                      id={titleId}
                      className="text-2xl font-extrabold tracking-normal text-neutral-950 dark:text-white sm:text-3xl"
                    >
                      외부 쇼핑몰로 이동합니다
                    </h2>
                  </div>

                  <p
                    id={descriptionId}
                    className="mt-7 text-base leading-8 text-slate-700 dark:text-neutral-300 sm:text-lg"
                  >
                    선택하신 핫딜은 외부 판매 페이지에서 확인할 수 있습니다.
                    <br />
                    가격, 재고, 배송 정보는 판매처 기준으로 변경될 수 있어요.
                  </p>

                  <p className="mt-8 text-sm font-bold text-slate-700 dark:text-neutral-300">
                    이동할 사이트
                  </p>
                  <div className="mt-3 flex min-h-16 items-center gap-3 rounded-lg border border-neutral-300 bg-white px-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
                    <span
                      className={`inline-flex size-8 shrink-0 items-center justify-center rounded-md text-sm font-black text-white ${siteBadge.className}`}
                    >
                      {siteBadge.label}
                    </span>
                    <span className="min-w-0 truncate text-lg font-extrabold text-neutral-950 dark:text-white">
                      {hostname}
                    </span>
                  </div>

                  <p className="mt-7 flex items-start gap-2 text-sm font-medium leading-6 text-slate-600 dark:text-neutral-300">
                    <ShieldCheck
                      size={18}
                      className="mt-0.5 shrink-0 text-slate-500 dark:text-neutral-400"
                      aria-hidden="true"
                    />
                    구매 전 상품 정보와 판매처 정책을 꼭 확인해주세요.
                  </p>

                  <div className="mt-8 grid gap-3">
                    <button
                      type="button"
                      className="h-14 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 text-base font-extrabold text-white shadow-lg shadow-emerald-600/20 hover:from-emerald-700 hover:to-teal-700"
                      onClick={handleConfirm}
                    >
                      계속 이동하기
                    </button>
                    <button
                      type="button"
                      className="h-14 rounded-lg border border-neutral-300 bg-white text-base font-extrabold text-neutral-950 shadow-sm hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:hover:bg-neutral-900"
                      onClick={() => setIsOpen(false)}
                    >
                      취소
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function formatHostname(href: string) {
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return "외부 사이트";
  }
}

function getSiteBadge(hostname: string) {
  const normalized = hostname.toLowerCase();

  if (normalized.includes("naver.com")) {
    return {
      label: "N",
      className: "bg-[#03c75a]",
    };
  }

  if (normalized.includes("coupang.com")) {
    return {
      label: "C",
      className: "bg-[#e52222]",
    };
  }

  if (normalized.includes("gmarket.co.kr")) {
    return {
      label: "G",
      className: "bg-[#00a3e0]",
    };
  }

  if (normalized.includes("11st.co.kr")) {
    return {
      label: "11",
      className: "bg-[#f43142]",
    };
  }

  return {
    label: hostname.slice(0, 1).toUpperCase(),
    className: "bg-neutral-800 dark:bg-neutral-700",
  };
}
