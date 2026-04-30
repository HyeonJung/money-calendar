"use client";

import { useMemo, useState } from "react";
import { Calculator, CircleDollarSign } from "lucide-react";
import type { Ipo } from "@/lib/ipos";

type SubscriptionCalculatorProps = {
  ipo: Ipo;
};

export function SubscriptionCalculator({ ipo }: SubscriptionCalculatorProps) {
  const baseOfferPrice =
    ipo.confirmedOfferPrice ?? ipo.offerPriceRangeHigh ?? ipo.offerPriceRangeLow ?? null;
  const [quantity, setQuantity] = useState(100);
  const [allocatedQuantity, setAllocatedQuantity] = useState(1);
  const [depositRate, setDepositRate] = useState(50);

  const result = useMemo(() => {
    if (!baseOfferPrice) {
      return null;
    }

    const safeQuantity = Math.max(0, quantity);
    const safeAllocatedQuantity = Math.max(0, allocatedQuantity);
    const safeDepositRate = Math.max(0, Math.min(100, depositRate));
    const subscriptionAmount = baseOfferPrice * safeQuantity;
    const requiredDeposit = Math.round(subscriptionAmount * (safeDepositRate / 100));
    const allocationValue = baseOfferPrice * safeAllocatedQuantity;
    const expectedRefund = Math.max(0, requiredDeposit - allocationValue);

    return {
      subscriptionAmount,
      requiredDeposit,
      allocationValue,
      expectedRefund,
    };
  }, [allocatedQuantity, baseOfferPrice, depositRate, quantity]);

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center gap-2">
        <Calculator size={18} aria-hidden="true" className="text-emerald-700 dark:text-emerald-400" />
        <h2 className="text-lg font-semibold text-neutral-950 dark:text-white">청약 계산기</h2>
      </div>

      {baseOfferPrice ? (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <NumberField
              label="청약 수량"
              suffix="주"
              value={quantity}
              min={0}
              step={10}
              onChange={setQuantity}
            />
            <NumberField
              label="예상 배정"
              suffix="주"
              value={allocatedQuantity}
              min={0}
              step={1}
              onChange={setAllocatedQuantity}
            />
            <NumberField
              label="증거금률"
              suffix="%"
              value={depositRate}
              min={0}
              max={100}
              step={5}
              onChange={setDepositRate}
            />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <CalcMetric label="기준 공모가" value={formatMoney(baseOfferPrice)} />
            <CalcMetric label="청약 금액" value={formatMoney(result?.subscriptionAmount)} />
            <CalcMetric label="필요 증거금" value={formatMoney(result?.requiredDeposit)} strong />
            <CalcMetric label="예상 환불" value={formatMoney(result?.expectedRefund)} />
          </div>

          <p className="mt-3 flex items-start gap-1.5 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
            <CircleDollarSign size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
            실제 배정 수량과 환불금은 주관사 최종 배정 결과 기준입니다.
          </p>
        </>
      ) : (
        <p className="mt-4 rounded-lg bg-neutral-50 p-4 text-sm leading-6 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300">
          공모가가 확인되면 계산기를 사용할 수 있습니다.
        </p>
      )}
    </section>
  );
}

function NumberField({
  label,
  suffix,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  suffix: string;
  value: number;
  min: number;
  max?: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{label}</span>
      <span className="mt-1 flex h-11 overflow-hidden rounded-md border border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-900">
        <input
          type="number"
          inputMode="numeric"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(event) => onChange(Number(event.target.value))}
          className="min-w-0 flex-1 bg-transparent px-3 text-sm font-semibold text-neutral-900 outline-none dark:text-neutral-100"
        />
        <span className="inline-flex w-12 items-center justify-center border-l border-neutral-200 text-sm font-semibold text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
          {suffix}
        </span>
      </span>
    </label>
  );
}

function CalcMetric({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="rounded-md bg-neutral-50 px-3 py-2.5 dark:bg-neutral-900">
      <dt className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{label}</dt>
      <dd
        className={[
          "mt-1 truncate text-sm font-semibold",
          strong
            ? "text-emerald-700 dark:text-emerald-300"
            : "text-neutral-900 dark:text-neutral-100",
        ].join(" ")}
      >
        {value}
      </dd>
    </div>
  );
}

function formatMoney(value?: number | null) {
  if (value === null || value === undefined) {
    return "미정";
  }

  return `${value.toLocaleString("ko-KR")}원`;
}
